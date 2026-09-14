import { SchedulerRegistry } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IdempotencyService } from '@platform/idempotency/idempotency.service';
import { PLATFORM_EVENTS } from '../../events';
import { SchedulerModuleConfig } from '../scheduler.config';
import { IdempotencyCleanupJob } from './idempotency-cleanup.job';

describe('IdempotencyCleanupJob', () => {
  let idempotencyService: { pruneExpired: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let cronJob: { setTime: jest.Mock; start: jest.Mock };
  let schedulerRegistry: { getCronJob: jest.Mock };
  let job: IdempotencyCleanupJob;

  const config: SchedulerModuleConfig = {
    idempotencyCleanupCron: '0 3 * * *',
    secretsRotationCron: '0 4 1 * *',
    dataRetentionCleanupCron: '0 2 * * *',
  };

  beforeEach(() => {
    idempotencyService = { pruneExpired: jest.fn() };
    eventEmitter = { emit: jest.fn() };
    cronJob = { setTime: jest.fn(), start: jest.fn() };
    schedulerRegistry = { getCronJob: jest.fn().mockReturnValue(cronJob) };

    job = new IdempotencyCleanupJob(
      idempotencyService as unknown as IdempotencyService,
      eventEmitter as unknown as EventEmitter2,
      schedulerRegistry as unknown as SchedulerRegistry,
      config,
    );
  });

  describe('onApplicationBootstrap', () => {
    it('sets the cron time from config and starts the job', () => {
      job.onApplicationBootstrap();

      expect(schedulerRegistry.getCronJob).toHaveBeenCalledWith('idempotency-cleanup');
      expect(cronJob.setTime).toHaveBeenCalled();
      expect(cronJob.start).toHaveBeenCalled();
    });
  });

  describe('run', () => {
    it('prunes expired records and emits SCHEDULER_JOB_COMPLETED', async () => {
      idempotencyService.pruneExpired.mockResolvedValue(undefined);

      await job.run();

      expect(idempotencyService.pruneExpired).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        PLATFORM_EVENTS.SCHEDULER_JOB_COMPLETED,
        expect.objectContaining({ jobName: 'idempotency-cleanup', durationMs: expect.any(Number) }),
      );
    });

    it('emits SCHEDULER_JOB_FAILED with the error message when pruning fails', async () => {
      idempotencyService.pruneExpired.mockRejectedValue(new Error('db unavailable'));

      await job.run();

      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.SCHEDULER_JOB_FAILED, {
        jobName: 'idempotency-cleanup',
        reason: 'db unavailable',
      });
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        PLATFORM_EVENTS.SCHEDULER_JOB_COMPLETED,
        expect.anything(),
      );
    });

    it('falls back to a generic reason when a non-Error is thrown', async () => {
      idempotencyService.pruneExpired.mockRejectedValue('not-an-error-object');

      await job.run();

      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.SCHEDULER_JOB_FAILED, {
        jobName: 'idempotency-cleanup',
        reason: 'Unknown error',
      });
    });
  });
});
