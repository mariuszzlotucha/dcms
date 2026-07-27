import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import CircuitBreaker from 'opossum';
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../../events';
import { CIRCUIT_BREAKER_MODULE_CONFIG, CircuitBreakerModuleConfig } from '../circuit-breaker.config';

type Thunk<T> = () => Promise<T>;

@Injectable()
export class CircuitBreakerRegistry {
  private readonly breakers = new Map<string, CircuitBreaker<[Thunk<unknown>], unknown>>();

  constructor(
    @Inject(CIRCUIT_BREAKER_MODULE_CONFIG)
    private readonly config: CircuitBreakerModuleConfig,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async wrap<T>(providerName: string, fn: Thunk<T>): Promise<T> {
    const breaker = this.getOrCreateBreaker(providerName);
    return breaker.fire(fn as Thunk<unknown>) as Promise<T>;
  }

  private getOrCreateBreaker(providerName: string): CircuitBreaker<[Thunk<unknown>], unknown> {
    const existing = this.breakers.get(providerName);
    if (existing) {
      return existing;
    }

    const settings = { ...this.config.defaults, ...this.config.overrides?.[providerName] };

    const breaker = new CircuitBreaker<[Thunk<unknown>], unknown>((thunk) => thunk(), {
      timeout: settings.timeoutMs,
      errorThresholdPercentage: settings.errorThresholdPercentage,
      resetTimeout: settings.resetTimeoutMs,
    });

    breaker.on('open', () => {
      this.eventEmitter.emit(
        PLATFORM_EVENTS.CIRCUIT_BREAKER_OPENED,
        { provider: providerName } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.CIRCUIT_BREAKER_OPENED],
      );
    });

    breaker.on('close', () => {
      this.eventEmitter.emit(
        PLATFORM_EVENTS.CIRCUIT_BREAKER_CLOSED,
        { provider: providerName } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.CIRCUIT_BREAKER_CLOSED],
      );
    });

    this.breakers.set(providerName, breaker);
    return breaker;
  }
}
