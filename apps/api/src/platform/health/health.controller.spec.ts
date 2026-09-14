import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: { checkLiveness: jest.Mock; checkReadiness: jest.Mock };

  beforeEach(async () => {
    healthService = {
      checkLiveness: jest.fn().mockResolvedValue({ status: 'ok', info: {}, error: {}, details: {} }),
      checkReadiness: jest.fn().mockResolvedValue({ status: 'ok', info: {}, error: {}, details: {} }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthService }],
    }).compile();

    controller = module.get(HealthController);
  });

  it('delegates liveness to HealthService.checkLiveness', async () => {
    const result = await controller.liveness();

    expect(healthService.checkLiveness).toHaveBeenCalled();
    expect(result).toEqual({ status: 'ok', info: {}, error: {}, details: {} });
  });

  it('delegates readiness to HealthService.checkReadiness', async () => {
    const result = await controller.readiness();

    expect(healthService.checkReadiness).toHaveBeenCalled();
    expect(result).toEqual({ status: 'ok', info: {}, error: {}, details: {} });
  });
});
