import { Test, TestingModule } from '@nestjs/testing';
import { HealthIndicatorFunction } from '@nestjs/terminus';
import { HealthModule } from './health.module';
import { HealthService } from './health.service';
import { HEALTH_MODULE_CONFIG } from './health.config';

describe('HealthModule', () => {
  describe('forRoot', () => {
    it('provides HealthService using the given config', async () => {
      const checks: HealthIndicatorFunction[] = [jest.fn()];
      const module: TestingModule = await Test.createTestingModule({
        imports: [HealthModule.forRoot({ checks })],
      }).compile();

      expect(module.get(HealthService)).toBeInstanceOf(HealthService);
      expect(module.get(HEALTH_MODULE_CONFIG)).toEqual({ checks });
    });

    it('defaults to an empty config when none is given', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [HealthModule.forRoot()],
      }).compile();

      expect(module.get(HEALTH_MODULE_CONFIG)).toEqual({});
    });
  });

  describe('forRootAsync', () => {
    it('resolves the config via the provided factory and its injected deps', async () => {
      const checks: HealthIndicatorFunction[] = [jest.fn()];

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          HealthModule.forRootAsync({
            useFactory: (prefix: string) => ({ checks, source: prefix }),
            inject: ['CHECKS_PREFIX'],
            imports: [
              {
                module: class ConfigStub {},
                providers: [{ provide: 'CHECKS_PREFIX', useValue: 'db' }],
                exports: ['CHECKS_PREFIX'],
                global: true,
              },
            ],
          }),
        ],
      }).compile();

      expect(module.get(HealthService)).toBeInstanceOf(HealthService);
      expect(module.get(HEALTH_MODULE_CONFIG)).toEqual({ checks, source: 'db' });
    });
  });
});
