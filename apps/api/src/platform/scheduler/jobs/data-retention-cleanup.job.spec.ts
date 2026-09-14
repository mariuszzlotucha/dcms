import { SchedulerRegistry } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataRetentionService } from '@platform/data-retention/data-retention.service';
import { PLATFORM_EVENTS } from '../../events';
import { SchedulerModuleConfig } from '../scheduler.config';
import { DataRetentionCleanupJob } from './data-retention-cleanup.job';

describe('DataRetentionCleanupJob', () => {
  let dataRetentionService: {
    purgeRevokedConsentData: jest.Mock;
    purgeInactiveAccounts: jest.Mock;
    purgeOrphanedFiles: jest.Mock;
  };
  let eventEmitter: { emit: jest.Mock };
  let cronJob: { setTime: jest.Mock; start: jest.Mock };
  let schedulerRegistry: { getCronJob: jest.Mock };
  let job: DataRetentionCleanupJob;

  const config: SchedulerModuleConfig = {
    idempotencyCleanupCron: '0 3 * * *',
    secretsRotationCron: '0 4 1 * *',
    dataRetentionCleanupCron: '0 2 * * *',
  };

  beforeEach(() => {
    dataRetentionService = {
      purgeRevokedConsentData: jest.fn().mockResolvedValue(0),
      purgeInactiveAccounts: jest.fn().mockResolvedValue(0),
      purgeOrphanedFiles: jest.fn().mockResolvedValue(0),
    };
    eventEmitter = { emit: jest.fn() };
    cronJob = { setTime: jest.fn(), start: jest.fn() };
    schedulerRegistry = { getCronJob: jest.fn().mockReturnValue(cronJob) };

    job = new DataRetentionCleanupJob(
      dataRetentionService as unknown as DataRetentionService,
      eventEmitter as unknown as EventEmitter2,
      schedulerRegistry as unknown as SchedulerRegistry,
      config,
    );
  });

  describe('onApplicationBootstrap', () => {
    it('sets the cron time from config and starts the job', () => {
      job.onApplicationBootstrap();

      expect(schedulerRegistry.getCronJob).toHaveBeenCalledWith('data-retention-cleanup');
      expect(cronJob.setTime).toHaveBeenCalled();
      expect(cronJob.start).toHaveBeenCalled();
    });
  });

  describe('run', () => {
    it('runs all three purges as a global sweep (no tenantId) and emits SCHEDULER_JOB_COMPLETED', async () => {
      await job.run();

      expect(dataRetentionService.purgeRevokedConsentData).toHaveBeenCalledWith();
      expect(dataRetentionService.purgeInactiveAccounts).toHaveBeenCalledWith();
      expect(dataRetentionService.purgeOrphanedFiles).toHaveBeenCalledWith();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        PLATFORM_EVENTS.SCHEDULER_JOB_COMPLETED,
        expect.objectContaining({ jobName: 'data-retention-cleanup' }),
      );
    });

    it('emits SCHEDULER_JOB_FAILED when a purge step throws', async () => {
      dataRetentionService.purgeInactiveAccounts.mockRejectedValue(new Error('purge failed'));

      await job.run();

      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.SCHEDULER_JOB_FAILED, {
        jobName: 'data-retention-cleanup',
        reason: 'purge failed',
      });
    });

    it('does not run purgeOrphanedFiles when purgeInactiveAccounts fails first', async () => {
      dataRetentionService.purgeInactiveAccounts.mockRejectedValue(new Error('purge failed'));

      await job.run();

      expect(dataRetentionService.purgeOrphanedFiles).not.toHaveBeenCalled();
    });
  });
});
