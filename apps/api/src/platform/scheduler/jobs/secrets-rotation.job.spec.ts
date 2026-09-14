import { SchedulerRegistry } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SecretsService } from '@platform/secrets/secrets.service';
import { PLATFORM_EVENTS } from '../../events';
import { SchedulerModuleConfig } from '../scheduler.config';
import { SecretsRotationJob } from './secrets-rotation.job';

describe('SecretsRotationJob', () => {
  let secretsService: { rotate: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let cronJob: { setTime: jest.Mock; start: jest.Mock };
  let schedulerRegistry: { getCronJob: jest.Mock };
  let job: SecretsRotationJob;

  const config: SchedulerModuleConfig = {
    idempotencyCleanupCron: '0 3 * * *',
    secretsRotationCron: '0 4 1 * *',
    dataRetentionCleanupCron: '0 2 * * *',
  };

  beforeEach(() => {
    secretsService = { rotate: jest.fn().mockResolvedValue(undefined) };
    eventEmitter = { emit: jest.fn() };
    cronJob = { setTime: jest.fn(), start: jest.fn() };
    schedulerRegistry = { getCronJob: jest.fn().mockReturnValue(cronJob) };

    job = new SecretsRotationJob(
      secretsService as unknown as SecretsService,
      eventEmitter as unknown as EventEmitter2,
      schedulerRegistry as unknown as SchedulerRegistry,
      config,
    );
  });

  describe('onApplicationBootstrap', () => {
    it('sets the cron time from config and starts the job', () => {
      job.onApplicationBootstrap();

      expect(schedulerRegistry.getCronJob).toHaveBeenCalledWith('secrets-rotation');
      expect(cronJob.setTime).toHaveBeenCalled();
      expect(cronJob.start).toHaveBeenCalled();
    });
  });

  describe('run', () => {
    it('rotates every known secret and emits SCHEDULER_JOB_COMPLETED', async () => {
      await job.run();

      expect(secretsService.rotate).toHaveBeenCalledWith('jwtSigningKey');
      expect(secretsService.rotate).toHaveBeenCalledWith('encryptionMasterKey');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        PLATFORM_EVENTS.SCHEDULER_JOB_COMPLETED,
        expect.objectContaining({ jobName: 'secrets-rotation' }),
      );
    });

    it('emits SCHEDULER_JOB_FAILED and stops rotating further secrets when one rotation throws', async () => {
      secretsService.rotate.mockRejectedValueOnce(new Error('rotation locked'));

      await job.run();

      expect(secretsService.rotate).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.SCHEDULER_JOB_FAILED, {
        jobName: 'secrets-rotation',
        reason: 'rotation locked',
      });
    });
  });
});
