import { DynamicModule, InjectionToken, Module, OptionalFactoryDependency, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyRecord } from './entities/idempotency-record.entity';
import { IDEMPOTENCY_MODULE_CONFIG, IdempotencyModuleConfig } from './idempotency.config';
import { IdempotencyInterceptor } from './interceptors/idempotency.interceptor';

interface IdempotencyModuleAsyncOptions {
  useFactory: (...args: unknown[]) => IdempotencyModuleConfig | Promise<IdempotencyModuleConfig>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

@Module({})
export class IdempotencyModule {
  static forRoot(config: IdempotencyModuleConfig): DynamicModule {
    return {
      module: IdempotencyModule,
      global: true,
      imports: [TypeOrmModule.forFeature([IdempotencyRecord])],
      providers: [{ provide: IDEMPOTENCY_MODULE_CONFIG, useValue: config }, IdempotencyInterceptor],
      exports: [IdempotencyInterceptor],
    };
  }

  static forRootAsync(options: IdempotencyModuleAsyncOptions): DynamicModule {
    const configProvider: Provider = {
      provide: IDEMPOTENCY_MODULE_CONFIG,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: IdempotencyModule,
      global: true,
      imports: [TypeOrmModule.forFeature([IdempotencyRecord])],
      providers: [configProvider, IdempotencyInterceptor],
      exports: [IdempotencyInterceptor],
    };
  }
}
