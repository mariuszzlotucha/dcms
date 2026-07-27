import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CronTime } from 'cron';
import { IdempotencyService } from '@platform/idempotency/idempotency.service';
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../../events';
import { SCHEDULER_MODULE_CONFIG, SchedulerModuleConfig } from '../scheduler.config';

const JOB_NAME = 'idempotency-cleanup';

@Injectable()
export class IdempotencyCleanupJob implements OnModuleInit {
  private readonly logger = new Logger(IdempotencyCleanupJob.name);

  constructor(
    private readonly idempotencyService: IdempotencyService,
    private readonly eventEmitter: EventEmitter2,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(SCHEDULER_MODULE_CONFIG)
    private readonly config: SchedulerModuleConfig,
  ) {}

  onModuleInit(): void {
    const job = this.schedulerRegistry.getCronJob(JOB_NAME);
    job.setTime(new CronTime(this.config.idempotencyCleanupCron));
    job.start();
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: JOB_NAME, disabled: true })
  async run(): Promise<void> {
    const startedAt = Date.now();

    try {
      await this.idempotencyService.pruneExpired();

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
