import { EventEmitter2 } from '@nestjs/event-emitter';
import { PLATFORM_EVENTS } from '../events';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagsModuleConfig } from './feature-flags.config';
import { FeatureFlag } from './entities/feature-flag.entity';

describe('FeatureFlagsService', () => {
  let featureFlags: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; find: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let service: FeatureFlagsService;

  const config: FeatureFlagsModuleConfig = { defaultFlags: { beta_dashboard: false, dark_mode: true } };

  beforeEach(() => {
    featureFlags = {
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => ({ id: 'f1', ...data }) as FeatureFlag),
      find: jest.fn(),
    };
    eventEmitter = { emit: jest.fn() };

    service = new FeatureFlagsService(featureFlags as never, config, eventEmitter as unknown as EventEmitter2);
  });

  describe('isEnabled', () => {
    it('returns the per-tenant override when one exists', async () => {
      featureFlags.findOne.mockResolvedValue({ enabled: true } as FeatureFlag);

      await expect(service.isEnabled('t1', 'beta_dashboard')).resolves.toBe(true);
    });

    it('falls back to the configured default when there is no tenant override', async () => {
      featureFlags.findOne.mockResolvedValue(null);

      await expect(service.isEnabled('t1', 'dark_mode')).resolves.toBe(true);
      await expect(service.isEnabled('t1', 'beta_dashboard')).resolves.toBe(false);
    });

    it('defaults to false for an entirely unknown flag with no override and no default', async () => {
      featureFlags.findOne.mockResolvedValue(null);

      await expect(service.isEnabled('t1', 'nonexistent_flag')).resolves.toBe(false);
    });
  });

  describe('setFlag', () => {
    it('creates a new flag row and emits FEATURE_FLAG_TOGGLED', async () => {
      featureFlags.findOne.mockResolvedValue(null);

      await service.setFlag('t1', 'beta_dashboard', true);

      expect(featureFlags.create).toHaveBeenCalledWith({ tenantId: 't1', flagKey: 'beta_dashboard', enabled: true });
      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.FEATURE_FLAG_TOGGLED, {
        tenantId: 't1',
        flagKey: 'beta_dashboard',
        enabled: true,
      });
    });

    it('updates an existing row in place when the value actually changes', async () => {
      const existing = { id: 'f1', tenantId: 't1', flagKey: 'beta_dashboard', enabled: false } as FeatureFlag;
      featureFlags.findOne.mockResolvedValue(existing);

      await service.setFlag('t1', 'beta_dashboard', true);

      expect(featureFlags.create).not.toHaveBeenCalled();
      expect(featureFlags.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'f1', enabled: true }));
    });

    it('is a no-op (no save, no event) when the flag is already set to the requested value', async () => {
      const existing = { id: 'f1', tenantId: 't1', flagKey: 'beta_dashboard', enabled: true } as FeatureFlag;
      featureFlags.findOne.mockResolvedValue(existing);

      const result = await service.setFlag('t1', 'beta_dashboard', true);

      expect(featureFlags.save).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });
  });

  describe('listFlags', () => {
    it('merges tenant overrides on top of the configured defaults', async () => {
      featureFlags.find.mockResolvedValue([{ flagKey: 'beta_dashboard', enabled: true } as FeatureFlag]);

      const result = await service.listFlags('t1');

      expect(result).toEqual({ beta_dashboard: true, dark_mode: true });
    });

    it('includes flags with no default that only exist as a tenant override', async () => {
      featureFlags.find.mockResolvedValue([{ flagKey: 'custom_flag', enabled: true } as FeatureFlag]);

      const result = await service.listFlags('t1');

      expect(result).toEqual({ beta_dashboard: false, dark_mode: true, custom_flag: true });
    });

    it('returns just the defaults when the tenant has no overrides', async () => {
      featureFlags.find.mockResolvedValue([]);

      await expect(service.listFlags('t1')).resolves.toEqual({ beta_dashboard: false, dark_mode: true });
    });
  });
});
