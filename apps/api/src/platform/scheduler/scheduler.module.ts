import { DynamicModule, InjectionToken, Module, OptionalFactoryDependency, Provider } from '@nestjs/common';
import { SCHEDULER_MODULE_CONFIG, SchedulerModuleConfig } from './scheduler.config';
import { IdempotencyCleanupJob } from './jobs/idempotency-cleanup.job';
import { SecretsRotationJob } from './jobs/secrets-rotation.job';

interface SchedulerModuleAsyncOptions {
  useFactory: (...args: unknown[]) => SchedulerModuleConfig | Promise<SchedulerModuleConfig>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

@Module({})
export class SchedulerModule {
  static forRoot(config: SchedulerModuleConfig): DynamicModule {
    return {
      module: SchedulerModule,
      providers: [
        { provide: SCHEDULER_MODULE_CONFIG, useValue: config },
        IdempotencyCleanupJob,
        SecretsRotationJob,
      ],
    };
  }

  static forRootAsync(options: SchedulerModuleAsyncOptions): DynamicModule {
    const configProvider: Provider = {
      provide: SCHEDULER_MODULE_CONFIG,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: SchedulerModule,
      providers: [configProvider, IdempotencyCleanupJob, SecretsRotationJob],
    };
  }
}
