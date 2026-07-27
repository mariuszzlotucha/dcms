import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CronTime } from 'cron';
import { SecretsService } from '@platform/secrets/secrets.service';
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../../events';
import { SCHEDULER_MODULE_CONFIG, SchedulerModuleConfig } from '../scheduler.config';

const JOB_NAME = 'secrets-rotation';
const KNOWN_SECRET_NAMES = ['jwtSigningKey', 'encryptionMasterKey'];

@Injectable()
export class SecretsRotationJob implements OnModuleInit {
  private readonly logger = new Logger(SecretsRotationJob.name);

  constructor(
    private readonly secretsService: SecretsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(SCHEDULER_MODULE_CONFIG)
    private readonly config: SchedulerModuleConfig,
  ) {}

  onModuleInit(): void {
    const job = this.schedulerRegistry.getCronJob(JOB_NAME);
    job.setTime(new CronTime(this.config.secretsRotationCron));
    job.start();
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: JOB_NAME, disabled: true })
  async run(): Promise<void> {
    const startedAt = Date.now();

    try {
      for (const secretName of KNOWN_SECRET_NAMES) {
        await this.secretsService.rotate(secretName);
      }

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
