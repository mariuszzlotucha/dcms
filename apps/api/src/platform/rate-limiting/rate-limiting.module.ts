import { DynamicModule, InjectionToken, Module, OptionalFactoryDependency } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler';
import { RateLimitingModuleConfig } from './rate-limiting.config';
import { TenantThrottlerGuard } from './guards/tenant-throttler.guard';

interface RateLimitingModuleAsyncOptions {
  useFactory: (...args: unknown[]) => RateLimitingModuleConfig | Promise<RateLimitingModuleConfig>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

@Module({})
export class RateLimitingModule {
  static forRoot(config: RateLimitingModuleConfig): DynamicModule {
    return {
      module: RateLimitingModule,
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ ttl: config.ttlMs, limit: config.limit }],
        }),
      ],
      providers: [{ provide: APP_GUARD, useClass: TenantThrottlerGuard }],
    };
  }

  static forRootAsync(options: RateLimitingModuleAsyncOptions): DynamicModule {
    return {
      module: RateLimitingModule,
      imports: [
        ThrottlerModule.forRootAsync({
          inject: options.inject ?? [],
          useFactory: async (...args: unknown[]): Promise<ThrottlerModuleOptions> => {
            const config = await options.useFactory(...args);
            return { throttlers: [{ ttl: config.ttlMs, limit: config.limit }] };
          },
        }),
      ],
      providers: [{ provide: APP_GUARD, useClass: TenantThrottlerGuard }],
    };
  }
}
