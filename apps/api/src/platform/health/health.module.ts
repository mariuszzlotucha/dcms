import { DynamicModule, Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import {
  HEALTH_MODULE_CONFIG,
  HealthModuleAsyncOptions,
  HealthModuleConfig,
} from './health.config';

@Module({})
export class HealthModule {
  static forRoot(config: HealthModuleConfig = {}): DynamicModule {
    return {
      module: HealthModule,
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [
        {
          provide: HEALTH_MODULE_CONFIG,
          useValue: config,
        },
        HealthService,
      ],
      exports: [HealthService],
    };
  }

  static forRootAsync(options: HealthModuleAsyncOptions): DynamicModule {
    return {
      module: HealthModule,
      imports: [TerminusModule, ...(options.imports ?? [])],
      controllers: [HealthController],
      providers: [
        {
          provide: HEALTH_MODULE_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        HealthService,
      ],
      exports: [HealthService],
    };
  }
}
