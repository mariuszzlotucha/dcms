import { AnalyticsInsightsService } from './analytics-insights.service';
import { TenantMetric } from './entities/tenant-metric.entity';
import { NegotiationTiming } from './entities/negotiation-timing.entity';
import { AnalyticsReport } from './entities/analytics-report.entity';

describe('AnalyticsInsightsService', () => {
  let tenantMetrics: { findOne: jest.Mock; find: jest.Mock; manager: { query: jest.Mock } };
  let negotiationTimings: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; remove: jest.Mock };
  let analyticsReports: { find: jest.Mock; create: jest.Mock; save: jest.Mock };
  let featureFlagsService: { isEnabled: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let service: AnalyticsInsightsService;

  // Keeps a fake table of metric rows keyed by "tenantId::metric" so the
  // read-modify-write sequences inside the service behave like a real repo.
  let metricStore: Map<string, TenantMetric>;

  beforeEach(() => {
    metricStore = new Map();

    tenantMetrics = {
      findOne: jest.fn(async ({ where }: { where: { tenantId: string; metric: string } }) =>
        metricStore.get(`${where.tenantId}::${where.metric}`) ?? null,
      ),
      find: jest.fn(async ({ where }: { where: { tenantId: string } }) =>
        [...metricStore.values()].filter((row) => row.tenantId === where.tenantId),
      ),
      // Mimics the atomic upsert in adjustMetric (GREATEST(...+ delta, 0),
      // RETURNING value) and setMetric (plain value = $4, no RETURNING)
      // against the same in-memory table `findOne`/`find` read from.
      manager: {
        query: jest.fn(async (sql: string, params: [string, string, string, number]) => {
          const [id, tenantId, metric, num] = params;
          const key = `${tenantId}::${metric}`;
          const existing = metricStore.get(key);
          const isAdjust = sql.includes('GREATEST');
          const value = isAdjust ? Math.max((existing?.value ?? 0) + num, 0) : num;

          metricStore.set(key, {
            id: existing?.id ?? id,
            tenantId,
            metric,
            value,
            updatedAt: new Date(),
          } as TenantMetric);

          return isAdjust ? [{ value }] : [];
        }),
      },
    };
    negotiationTimings = {
      findOne: jest.fn(),
      create: jest.fn((data) => data as NegotiationTiming),
      save: jest.fn(async (data) => ({ id: 'timing-1', ...data }) as NegotiationTiming),
      remove: jest.fn(),
    };
    analyticsReports = {
      find: jest.fn(),
      create: jest.fn((data) => data as AnalyticsReport),
      save: jest.fn(async (data) => ({ id: 'report-1', ...data }) as AnalyticsReport),
    };
    featureFlagsService = { isEnabled: jest.fn().mockResolvedValue(false) };
    eventEmitter = { emit: jest.fn() };

    service = new AnalyticsInsightsService(
      tenantMetrics as never,
      negotiationTimings as never,
      analyticsReports as never,
      featureFlagsService as never,
      eventEmitter as never,
    );
  });

  describe('recordContractStatusChanged', () => {
    it('decrements the previous status counter (clamped at 0) and increments the new one, emitting both updates', async () => {
      await service.recordContractStatusChanged('t1', 'c1', 'draft', 'in_review');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'analytics.metricUpdated',
        expect.objectContaining({ tenantId: 't1', metric: 'contracts.status.draft.count', value: 0 }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'analytics.metricUpdated',
        expect.objectContaining({ tenantId: 't1', metric: 'contracts.status.in_review.count', value: 1 }),
      );
    });

    it('starts a negotiation timing row when entering negotiation', async () => {
      negotiationTimings.findOne.mockResolvedValue(null);

      await service.recordContractStatusChanged('t1', 'c1', 'in_review', 'negotiation');

      expect(negotiationTimings.save).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 't1', contractId: 'c1' }));
    });

    it('closes the negotiation timing and updates the running average when leaving negotiation', async () => {
      const enteredAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      negotiationTimings.findOne.mockResolvedValue({ id: 'timing-1', tenantId: 't1', contractId: 'c1', enteredNegotiationAt: enteredAt });

      await service.recordContractStatusChanged('t1', 'c1', 'negotiation', 'approved');

      expect(negotiationTimings.remove).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'analytics.metricUpdated',
        expect.objectContaining({ tenantId: 't1', metric: 'negotiation.completed.count', value: 1 }),
      );

      const avgCall = eventEmitter.emit.mock.calls.find(
        ([, payload]) => payload.metric === 'negotiation.avgDurationHours',
      );
      expect(avgCall[1].value).toBeCloseTo(2, 1);
    });
  });

  describe('simple counters', () => {
    it('increments esignature.completed.count', async () => {
      await service.recordEsignatureCompleted('t1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'analytics.metricUpdated',
        expect.objectContaining({ tenantId: 't1', metric: 'esignature.completed.count', value: 1 }),
      );
    });

    it('increments esignature.expired.count', async () => {
      await service.recordEsignatureExpired('t1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'analytics.metricUpdated',
        expect.objectContaining({ metric: 'esignature.expired.count', value: 1 }),
      );
    });

    it('increments negotiation.revisionRequested.count', async () => {
      await service.recordRevisionRequested('t1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'analytics.metricUpdated',
        expect.objectContaining({ metric: 'negotiation.revisionRequested.count', value: 1 }),
      );
    });
  });

  describe('recordBillingSubscriptionUpdated', () => {
    it('snapshots the current active-contract count as the correlation proxy', async () => {
      await service.recordContractStatusChanged('t1', 'c1', 'signed', 'active');

      await service.recordBillingSubscriptionUpdated('t1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'analytics.metricUpdated',
        expect.objectContaining({ metric: 'billing.activeContractsAtPlanChange', value: 1 }),
      );
    });
  });

  describe('getDashboard', () => {
    it('excludes advanced-only metrics from the basic dashboard', async () => {
      await service.recordEsignatureCompleted('t1');
      await service.recordBillingSubscriptionUpdated('t1');

      const dashboard = await service.getDashboard('t1');

      expect(dashboard.some((row) => row.metric === 'esignature.completed.count')).toBe(true);
      expect(dashboard.some((row) => row.metric === 'billing.activeContractsAtPlanChange')).toBe(false);
    });
  });

  describe('generateReport', () => {
    it('generates a basic-tier report without advanced-only metrics when the flag is off', async () => {
      featureFlagsService.isEnabled.mockResolvedValue(false);
      await service.recordEsignatureCompleted('t1');
      await service.recordBillingSubscriptionUpdated('t1');

      const report = await service.generateReport('t1', 'u1');

      expect(report.tier).toBe('basic');
      expect(analyticsReports.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'basic',
          metrics: expect.not.objectContaining({ 'billing.activeContractsAtPlanChange': expect.anything() }),
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'analytics.reportGenerated',
        expect.objectContaining({ tenantId: 't1', reportId: 'report-1' }),
      );
    });

    it('generates an advanced-tier report including advanced-only metrics when the flag is on', async () => {
      featureFlagsService.isEnabled.mockResolvedValue(true);
      await service.recordBillingSubscriptionUpdated('t1');

      const report = await service.generateReport('t1', 'u1');

      expect(report.tier).toBe('advanced');
      expect(analyticsReports.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.objectContaining({ 'billing.activeContractsAtPlanChange': 0 }),
        }),
      );
    });
  });
});
