import { DynamicModule, InjectionToken, Module, OptionalFactoryDependency, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsageCounter } from './entities/usage-counter.entity';
import { USAGE_METERING_MODULE_CONFIG, UsageMeteringModuleConfig } from './usage-metering.config';
import { UsageMeteringService } from './usage-metering.service';

interface UsageMeteringModuleAsyncOptions {
  useFactory: (...args: unknown[]) => UsageMeteringModuleConfig | Promise<UsageMeteringModuleConfig>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

@Module({})
export class UsageMeteringModule {
  static forRoot(config: UsageMeteringModuleConfig): DynamicModule {
    return {
      module: UsageMeteringModule,
      global: true,
      imports: [TypeOrmModule.forFeature([UsageCounter])],
      providers: [{ provide: USAGE_METERING_MODULE_CONFIG, useValue: config }, UsageMeteringService],
      exports: [UsageMeteringService],
    };
  }

  static forRootAsync(options: UsageMeteringModuleAsyncOptions): DynamicModule {
    const configProvider: Provider = {
      provide: USAGE_METERING_MODULE_CONFIG,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: UsageMeteringModule,
      global: true,
      imports: [TypeOrmModule.forFeature([UsageCounter])],
      providers: [configProvider, UsageMeteringService],
      exports: [UsageMeteringService],
    };
  }
}
