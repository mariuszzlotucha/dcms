import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService, HealthIndicatorFunction } from '@nestjs/terminus';
import { HealthService } from './health.service';
import { HEALTH_MODULE_CONFIG, HealthModuleConfig } from './health.config';

describe('HealthService', () => {
  let healthCheckService: { check: jest.Mock };

  const buildService = async (config: HealthModuleConfig) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: HealthCheckService, useValue: healthCheckService },
        { provide: HEALTH_MODULE_CONFIG, useValue: config },
      ],
    }).compile();

    return module.get(HealthService);
  };

  beforeEach(() => {
    healthCheckService = { check: jest.fn().mockResolvedValue({ status: 'ok' }) };
  });

  describe('checkLiveness', () => {
    it('runs the health check with no indicators', async () => {
      const service = await buildService({});

      const result = await service.checkLiveness();

      expect(healthCheckService.check).toHaveBeenCalledWith([]);
      expect(result).toEqual({ status: 'ok' });
    });

    it('ignores configured readiness checks', async () => {
      const checks: HealthIndicatorFunction[] = [jest.fn()];
      const service = await buildService({ checks });

      await service.checkLiveness();

      expect(healthCheckService.check).toHaveBeenCalledWith([]);
    });
  });

  describe('checkReadiness', () => {
    it('runs the health check with the configured indicators', async () => {
      const checks: HealthIndicatorFunction[] = [jest.fn(), jest.fn()];
      const service = await buildService({ checks });

      const result = await service.checkReadiness();

      expect(healthCheckService.check).toHaveBeenCalledWith(checks);
      expect(result).toEqual({ status: 'ok' });
    });

    it('falls back to no indicators when none are configured', async () => {
      const service = await buildService({});

      await service.checkReadiness();

      expect(healthCheckService.check).toHaveBeenCalledWith([]);
    });

    it('falls back to no indicators when checks is undefined', async () => {
      const service = await buildService({ checks: undefined });

      await service.checkReadiness();

      expect(healthCheckService.check).toHaveBeenCalledWith([]);
    });
  });
});
