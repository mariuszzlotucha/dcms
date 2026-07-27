import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingService } from '@platform/billing/billing.service';
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../events';
import { UsageCounter } from './entities/usage-counter.entity';
import { USAGE_METERING_MODULE_CONFIG, UsageMeteringModuleConfig } from './usage-metering.config';

export interface UsageCheckResult {
  allowed: boolean;
  current: number;
  limit: number | null;
}

@Injectable()
export class UsageMeteringService {
  constructor(
    @InjectRepository(UsageCounter)
    private readonly usageCounters: Repository<UsageCounter>,
    @Inject(USAGE_METERING_MODULE_CONFIG)
    private readonly config: UsageMeteringModuleConfig,
    private readonly billingService: BillingService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async checkAndIncrement(tenantId: string, metric: string): Promise<UsageCheckResult> {
    const limit = await this.resolveLimit(tenantId, metric);
    const period = this.currentPeriod();

    if (limit === null) {
      const current = await this.atomicIncrement(tenantId, metric, period);
      return { allowed: true, current, limit: null };
    }

    if (limit <= 0) {
      const current = await this.readCount(tenantId, metric, period);
      this.emitLimitExceeded(tenantId, metric, limit, current);
      return { allowed: false, current, limit };
    }

    const incremented = await this.atomicIncrementIfBelowLimit(tenantId, metric, period, limit);

    if (incremented !== null) {
      return { allowed: true, current: incremented, limit };
    }

    const current = await this.readCount(tenantId, metric, period);
    this.emitLimitExceeded(tenantId, metric, limit, current);
    return { allowed: false, current, limit };
  }

  async getUsage(tenantId: string, metric: string): Promise<number> {
    return this.readCount(tenantId, metric, this.currentPeriod());
  }

  private async resolveLimit(tenantId: string, metric: string): Promise<number | null> {
    const subscription = await this.billingService.getSubscription(tenantId);

    if (!subscription?.plan) {
      return null;
    }

    return this.config.limitsByPlan[subscription.plan]?.[metric] ?? null;
  }

  private currentPeriod(): string {
    return new Date().toISOString().slice(0, 7);
  }

  private async readCount(tenantId: string, metric: string, period: string): Promise<number> {
    const counter = await this.usageCounters.findOne({ where: { tenantId, metric, period } });
    return counter?.count ?? 0;
  }

  private async atomicIncrement(tenantId: string, metric: string, period: string): Promise<number> {
    const result = await this.usageCounters.manager.query(
      `INSERT INTO usage_counters (id, "tenantId", metric, period, count)
       VALUES ($1, $2, $3, $4, 1)
       ON CONFLICT ("tenantId", metric, period)
       DO UPDATE SET count = usage_counters.count + 1
       RETURNING count`,
      [randomUUID(), tenantId, metric, period],
    );

    return result[0].count;
  }

  private async atomicIncrementIfBelowLimit(
    tenantId: string,
    metric: string,
    period: string,
    limit: number,
  ): Promise<number | null> {
    const result = await this.usageCounters.manager.query(
      `INSERT INTO usage_counters (id, "tenantId", metric, period, count)
       VALUES ($1, $2, $3, $4, 1)
       ON CONFLICT ("tenantId", metric, period)
       DO UPDATE SET count = usage_counters.count + 1
       WHERE usage_counters.count < $5
       RETURNING count`,
      [randomUUID(), tenantId, metric, period, limit],
    );

    return result.length > 0 ? result[0].count : null;
  }

  private emitLimitExceeded(tenantId: string, metric: string, limit: number, current: number): void {
    this.eventEmitter.emit(
      PLATFORM_EVENTS.USAGE_LIMIT_EXCEEDED,
      { tenantId, metric, limit, current } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.USAGE_LIMIT_EXCEEDED],
    );
  }
}
