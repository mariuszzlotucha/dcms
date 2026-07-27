import { DynamicModule, InjectionToken, Module, OptionalFactoryDependency, Provider } from '@nestjs/common';
import { CIRCUIT_BREAKER_MODULE_CONFIG, CircuitBreakerModuleConfig } from './circuit-breaker.config';
import { CircuitBreakerRegistry } from './registry/circuit-breaker.registry';

interface CircuitBreakerModuleAsyncOptions {
  useFactory: (...args: unknown[]) => CircuitBreakerModuleConfig | Promise<CircuitBreakerModuleConfig>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}

@Module({})
export class CircuitBreakerModule {
  static forRoot(config: CircuitBreakerModuleConfig): DynamicModule {
    return {
      module: CircuitBreakerModule,
      global: true,
      providers: [{ provide: CIRCUIT_BREAKER_MODULE_CONFIG, useValue: config }, CircuitBreakerRegistry],
      exports: [CircuitBreakerRegistry],
    };
  }

  static forRootAsync(options: CircuitBreakerModuleAsyncOptions): DynamicModule {
    const configProvider: Provider = {
      provide: CIRCUIT_BREAKER_MODULE_CONFIG,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: CircuitBreakerModule,
      global: true,
      providers: [configProvider, CircuitBreakerRegistry],
      exports: [CircuitBreakerRegistry],
    };
  }
}
