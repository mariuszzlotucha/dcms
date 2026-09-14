import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureFlagsService } from '@platform/feature-flags/feature-flags.service';
import { EVENTS, EventPayloadMap } from '@';
import type { AnalyticsReportTier } from '@contracts/analytics-insights.schema';
import { AnalyticsReport } from './entities/analytics-report.entity';
import { NegotiationTiming } from './entities/negotiation-timing.entity';
import { TenantMetric } from './entities/tenant-metric.entity';

const ADVANCED_ANALYTICS_FLAG = 'advanced_analytics';

const METRICS = {
  contractsByStatus: (status: string) => `contracts.status.${status}.count`,
  esignatureCompleted: 'esignature.completed.count',
  esignatureExpired: 'esignature.expired.count',
  negotiationRevisionRequested: 'negotiation.revisionRequested.count',
  negotiationCompletedCount: 'negotiation.completed.count',
  negotiationAvgDurationHours: 'negotiation.avgDurationHours',
  billingActiveContractsAtPlanChange: 'billing.activeContractsAtPlanChange',
};

// Only these are gated behind the advanced_analytics flag — everything
// else (status counts, esignature/revision counters) is the base-plan
// dashboard. dcms-domain-architecture.md v1 monetization note.
const ADVANCED_ONLY_METRICS = new Set([
  METRICS.negotiationAvgDurationHours,
  METRICS.billingActiveContractsAtPlanChange,
  METRICS.negotiationCompletedCount,
]);

@Injectable()
export class AnalyticsInsightsService {
  constructor(
    @InjectRepository(TenantMetric)
    private readonly tenantMetrics: Repository<TenantMetric>,
    @InjectRepository(NegotiationTiming)
    private readonly negotiationTimings: Repository<NegotiationTiming>,
    @InjectRepository(AnalyticsReport)
    private readonly analyticsReports: Repository<AnalyticsReport>,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async recordContractStatusChanged(
    tenantId: string,
    contractId: string,
    previousStatus: string,
    newStatus: string,
  ): Promise<void> {
    await this.adjustMetric(tenantId, METRICS.contractsByStatus(previousStatus), -1);
    await this.adjustMetric(tenantId, METRICS.contractsByStatus(newStatus), 1);

    if (newStatus === 'negotiation') {
      const existing = await this.negotiationTimings.findOne({ where: { tenantId, contractId } });

      if (!existing) {
        await this.negotiationTimings.save(this.negotiationTimings.create({ tenantId, contractId }));
      }
    }

    if (previousStatus === 'negotiation') {
      await this.closeNegotiationTiming(tenantId, contractId);
    }
  }

  async recordEsignatureCompleted(tenantId: string): Promise<void> {
    await this.adjustMetric(tenantId, METRICS.esignatureCompleted, 1);
  }

  async recordEsignatureExpired(tenantId: string): Promise<void> {
    await this.adjustMetric(tenantId, METRICS.esignatureExpired, 1);
  }

  async recordRevisionRequested(tenantId: string): Promise<void> {
    await this.adjustMetric(tenantId, METRICS.negotiationRevisionRequested, 1);
  }

  // "correlates contract value with the tenant's plan/revenue" — there is
  // no Contract#value field anywhere in the system yet (deliberately out of
  // scope when `contracts` was built), so real dollar-value correlation
  // isn't possible. This records the only real, available proxy: operating
  // scale (active contracts) at the moment the plan changed.
  async recordBillingSubscriptionUpdated(tenantId: string): Promise<void> {
    const activeContracts = await this.getMetricValue(tenantId, METRICS.contractsByStatus('active'));
    await this.setMetric(tenantId, METRICS.billingActiveContractsAtPlanChange, activeContracts);
  }

  async getDashboard(tenantId: string): Promise<TenantMetric[]> {
    const rows = await this.tenantMetrics.find({ where: { tenantId } });
    return rows.filter((row) => !ADVANCED_ONLY_METRICS.has(row.metric));
  }

  async generateReport(tenantId: string, generatedBy: string): Promise<AnalyticsReport> {
    const advancedEnabled = await this.featureFlagsService.isEnabled(tenantId, ADVANCED_ANALYTICS_FLAG);
    const tier: AnalyticsReportTier = advancedEnabled ? 'advanced' : 'basic';

    const rows = await this.tenantMetrics.find({ where: { tenantId } });
    const metrics = Object.fromEntries(
      rows
        .filter((row) => advancedEnabled || !ADVANCED_ONLY_METRICS.has(row.metric))
        .map((row) => [row.metric, row.value]),
    );

    const report = await this.analyticsReports.save(
      this.analyticsReports.create({ tenantId, generatedBy, tier, metrics }),
    );

    this.eventEmitter.emit(
      EVENTS.ANALYTICS_REPORT_GENERATED,
      { tenantId, reportId: report.id } satisfies EventPayloadMap[typeof EVENTS.ANALYTICS_REPORT_GENERATED],
    );

    return report;
  }

  async listReports(tenantId: string): Promise<AnalyticsReport[]> {
    return this.analyticsReports.find({ where: { tenantId }, order: { generatedAt: 'DESC' } });
  }

  private async closeNegotiationTiming(tenantId: string, contractId: string): Promise<void> {
    const timing = await this.negotiationTimings.findOne({ where: { tenantId, contractId } });

    if (!timing) {
      return;
    }

    const durationHours = (Date.now() - timing.enteredNegotiationAt.getTime()) / (60 * 60 * 1000);
    await this.negotiationTimings.remove(timing);

    const previousCount = await this.getMetricValue(tenantId, METRICS.negotiationCompletedCount);
    const previousAvg = await this.getMetricValue(tenantId, METRICS.negotiationAvgDurationHours);
    const newCount = previousCount + 1;
    const newAvg = previousAvg + (durationHours - previousAvg) / newCount;

    await this.setMetric(tenantId, METRICS.negotiationCompletedCount, newCount);
    await this.setMetric(tenantId, METRICS.negotiationAvgDurationHours, newAvg);
  }

  private async getMetricValue(tenantId: string, metric: string): Promise<number> {
    const row = await this.tenantMetrics.findOne({ where: { tenantId, metric } });
    return row?.value ?? 0;
  }

  // Atomic upsert (mirrors usage-metering.service.ts's counter pattern) —
  // concurrent events for the same tenant+metric (e.g. two status changes
  // landing close together) must not race a separate read against a
  // separate write, or one adjustment silently overwrites the other.
  // GREATEST clamps at 0 inside the same statement, same as the old
  // Math.max(0, ...) did, just race-free.
  private async adjustMetric(tenantId: string, metric: string, delta: number): Promise<void> {
    const result = await this.tenantMetrics.manager.query(
      `INSERT INTO tenant_metrics (id, "tenantId", metric, value, "updatedAt")
       VALUES ($1, $2, $3, GREATEST($4, 0), now())
       ON CONFLICT ("tenantId", metric)
       DO UPDATE SET value = GREATEST(tenant_metrics.value + $4, 0), "updatedAt" = now()
       RETURNING value`,
      [randomUUID(), tenantId, metric, delta],
    );

    this.emitMetricUpdated(tenantId, metric, Number(result[0].value));
  }

  // Atomic upsert — a plain "set to this absolute value" (used for
  // point-in-time snapshots and computed aggregates like the negotiation
  // running average), as opposed to adjustMetric's relative delta.
  private async setMetric(tenantId: string, metric: string, value: number): Promise<void> {
    await this.tenantMetrics.manager.query(
      `INSERT INTO tenant_metrics (id, "tenantId", metric, value, "updatedAt")
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT ("tenantId", metric)
       DO UPDATE SET value = $4, "updatedAt" = now()`,
      [randomUUID(), tenantId, metric, value],
    );

    this.emitMetricUpdated(tenantId, metric, value);
  }

  private emitMetricUpdated(tenantId: string, metric: string, value: number): void {
    this.eventEmitter.emit(
      EVENTS.ANALYTICS_METRIC_UPDATED,
      { tenantId, metric, value } satisfies EventPayloadMap[typeof EVENTS.ANALYTICS_METRIC_UPDATED],
    );
  }
}
