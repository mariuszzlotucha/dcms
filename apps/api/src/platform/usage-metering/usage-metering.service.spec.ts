import { EventEmitter2 } from '@nestjs/event-emitter';
import { BillingService } from '@platform/billing/billing.service';
import { PLATFORM_EVENTS } from '../events';
import { UsageMeteringService } from './usage-metering.service';
import { UsageMeteringModuleConfig } from './usage-metering.config';
import { Subscription } from '@platform/billing/entities/subscription.entity';

describe('UsageMeteringService', () => {
  let usageCounters: { findOne: jest.Mock; manager: { query: jest.Mock } };
  let billingService: { getSubscription: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let service: UsageMeteringService;

  const config: UsageMeteringModuleConfig = {
    limitsByPlan: {
      starter: { 'contracts.create': 10 },
      pro: { 'contracts.create': 200 },
    },
  };

  beforeEach(() => {
    usageCounters = { findOne: jest.fn(), manager: { query: jest.fn() } };
    billingService = { getSubscription: jest.fn() };
    eventEmitter = { emit: jest.fn() };

    service = new UsageMeteringService(
      usageCounters as never,
      config,
      billingService as unknown as BillingService,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  describe('checkAndIncrement', () => {
    it('allows and increments unmetered when the tenant has no subscription at all', async () => {
      billingService.getSubscription.mockResolvedValue(null);
      usageCounters.manager.query.mockResolvedValue([{ count: 1 }]);

      const result = await service.checkAndIncrement('t1', 'contracts.create');

      expect(result).toEqual({ allowed: true, current: 1, limit: null });
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('allows and increments unmetered when the plan has no configured limit for this metric', async () => {
      billingService.getSubscription.mockResolvedValue({ plan: 'starter' } as Subscription);
      usageCounters.manager.query.mockResolvedValue([{ count: 5 }]);

      const result = await service.checkAndIncrement('t1', 'unmetered.metric');

      expect(result).toEqual({ allowed: true, current: 5, limit: null });
    });

    it('blocks immediately without incrementing when the plan limit is zero', async () => {
      billingService.getSubscription.mockResolvedValue({ plan: 'free' } as Subscription);
      const zeroLimitConfig: UsageMeteringModuleConfig = { limitsByPlan: { free: { 'contracts.create': 0 } } };
      const zeroLimitService = new UsageMeteringService(
        usageCounters as never,
        zeroLimitConfig,
        billingService as unknown as BillingService,
        eventEmitter as unknown as EventEmitter2,
      );
      usageCounters.findOne.mockResolvedValue({ count: 3 });

      const result = await zeroLimitService.checkAndIncrement('t1', 'contracts.create');

      expect(result).toEqual({ allowed: false, current: 3, limit: 0 });
      expect(usageCounters.manager.query).not.toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.USAGE_LIMIT_EXCEEDED, {
        tenantId: 't1',
        metric: 'contracts.create',
        limit: 0,
        current: 3,
      });
    });

    it('allows and increments when the atomic increment succeeds under the limit', async () => {
      billingService.getSubscription.mockResolvedValue({ plan: 'starter' } as Subscription);
      usageCounters.manager.query.mockResolvedValue([{ count: 4 }]);

      const result = await service.checkAndIncrement('t1', 'contracts.create');

      expect(result).toEqual({ allowed: true, current: 4, limit: 10 });
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('blocks and emits USAGE_LIMIT_EXCEEDED when the atomic increment reports the limit was already hit', async () => {
      billingService.getSubscription.mockResolvedValue({ plan: 'starter' } as Subscription);
      usageCounters.manager.query.mockResolvedValue([]);
      usageCounters.findOne.mockResolvedValue({ count: 10 });

      const result = await service.checkAndIncrement('t1', 'contracts.create');

      expect(result).toEqual({ allowed: false, current: 10, limit: 10 });
      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.USAGE_LIMIT_EXCEEDED, {
        tenantId: 't1',
        metric: 'contracts.create',
        limit: 10,
        current: 10,
      });
    });

    it('passes the configured limit into the conditional UPDATE query', async () => {
      billingService.getSubscription.mockResolvedValue({ plan: 'starter' } as Subscription);
      usageCounters.manager.query.mockResolvedValue([{ count: 1 }]);

      await service.checkAndIncrement('t1', 'contracts.create');

      expect(usageCounters.manager.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE usage_counters.count < $5'),
        expect.arrayContaining(['t1', 'contracts.create', expect.any(String), 10]),
      );
    });
  });

  describe('getUsage', () => {
    it('reads the current count for the current period, defaulting to 0', async () => {
      usageCounters.findOne.mockResolvedValue(null);

      await expect(service.getUsage('t1', 'contracts.create')).resolves.toBe(0);
    });

    it('returns the stored count when a counter exists', async () => {
      usageCounters.findOne.mockResolvedValue({ count: 7 });

      await expect(service.getUsage('t1', 'contracts.create')).resolves.toBe(7);
    });
  });
});
