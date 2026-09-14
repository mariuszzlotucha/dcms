import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CronTime } from 'cron';
import { DataRetentionService } from '@platform/data-retention/data-retention.service';
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../../events';
import { SCHEDULER_MODULE_CONFIG, SchedulerModuleConfig } from '../scheduler.config';

const JOB_NAME = 'data-retention-cleanup';

@Injectable()
export class DataRetentionCleanupJob implements OnApplicationBootstrap {
  private readonly logger = new Logger(DataRetentionCleanupJob.name);

  constructor(
    private readonly dataRetentionService: DataRetentionService,
    private readonly eventEmitter: EventEmitter2,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(SCHEDULER_MODULE_CONFIG)
    private readonly config: SchedulerModuleConfig,
  ) {}

  onApplicationBootstrap(): void {
    const job = this.schedulerRegistry.getCronJob(JOB_NAME);
    job.setTime(new CronTime(this.config.dataRetentionCleanupCron));
    job.start();
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: JOB_NAME, disabled: true })
  async run(): Promise<void> {
    const startedAt = Date.now();

    try {
      // No tenantId — this is a global sweep across every tenant, not a
      // per-tenant request; run() is only ever invoked by the cron trigger.
      await this.dataRetentionService.purgeRevokedConsentData();
      await this.dataRetentionService.purgeInactiveAccounts();
      await this.dataRetentionService.purgeOrphanedFiles();

      this.eventEmitter.emit(
        PLATFORM_EVENTS.SCHEDULER_JOB_COMPLETED,
        { jobName: JOB_NAME, durationMs: Date.now() - startedAt } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.SCHEDULER_JOB_COMPLETED],
      );
    } catch (error) {
      this.logger.error(`${JOB_NAME} failed`, error instanceof Error ? error.stack : String(error));

      this.eventEmitter.emit(
        PLATFORM_EVENTS.SCHEDULER_JOB_FAILED,
        {
          jobName: JOB_NAME,
          reason: error instanceof Error ? error.message : 'Unknown error',
        } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.SCHEDULER_JOB_FAILED],
      );
    }
  }
}
