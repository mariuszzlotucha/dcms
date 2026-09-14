import { EventEmitter2 } from '@nestjs/event-emitter';
import { PLATFORM_EVENTS } from '../../events';
import { CircuitBreakerRegistry } from './circuit-breaker.registry';
import { CircuitBreakerModuleConfig } from '../circuit-breaker.config';

describe('CircuitBreakerRegistry', () => {
  let eventEmitter: { emit: jest.Mock };
  let registry: CircuitBreakerRegistry;

  const config: CircuitBreakerModuleConfig = {
    defaults: { timeoutMs: 1000, errorThresholdPercentage: 50, resetTimeoutMs: 30_000 },
  };

  beforeEach(() => {
    eventEmitter = { emit: jest.fn() };
    registry = new CircuitBreakerRegistry(config, eventEmitter as unknown as EventEmitter2);
  });

  it('resolves with the thunk result when the call succeeds', async () => {
    await expect(registry.wrap('stripe', async () => 'ok')).resolves.toBe('ok');
  });

  it('propagates a rejection from the thunk while the circuit is closed', async () => {
    await expect(
      registry.wrap('stripe', async () => {
        throw new Error('provider down');
      }),
    ).rejects.toThrow('provider down');
  });

  it('reuses the same breaker for repeated calls to the same provider (opening it persists across calls)', async () => {
    // errorThresholdPercentage: 1 + volumeThreshold defaults to 0, so a
    // single failure is enough to open the circuit on the very next stats check.
    const lowThresholdConfig: CircuitBreakerModuleConfig = {
      defaults: { timeoutMs: 1000, errorThresholdPercentage: 1, resetTimeoutMs: 30_000 },
    };
    const lowThresholdRegistry = new CircuitBreakerRegistry(
      lowThresholdConfig,
      eventEmitter as unknown as EventEmitter2,
    );
    const failingThunk = jest.fn().mockRejectedValue(new Error('provider down'));

    await expect(lowThresholdRegistry.wrap('flaky-provider', failingThunk)).rejects.toThrow(
      'provider down',
    );
    expect(failingThunk).toHaveBeenCalledTimes(1);

    // The breaker is now open — a second call must short-circuit without
    // invoking the thunk again, proving the same breaker instance was reused.
    await expect(lowThresholdRegistry.wrap('flaky-provider', failingThunk)).rejects.toThrow();
    expect(failingThunk).toHaveBeenCalledTimes(1);
  });

  it('keeps breakers independent per provider — one provider opening does not affect another', async () => {
    const lowThresholdConfig: CircuitBreakerModuleConfig = {
      defaults: { timeoutMs: 1000, errorThresholdPercentage: 1, resetTimeoutMs: 30_000 },
    };
    const lowThresholdRegistry = new CircuitBreakerRegistry(
      lowThresholdConfig,
      eventEmitter as unknown as EventEmitter2,
    );

    await expect(
      lowThresholdRegistry.wrap('provider-a', async () => {
        throw new Error('down');
      }),
    ).rejects.toThrow();

    await expect(lowThresholdRegistry.wrap('provider-b', async () => 'ok')).resolves.toBe('ok');
  });

  it('applies a per-provider timeout override instead of the default', async () => {
    const overrideConfig: CircuitBreakerModuleConfig = {
      defaults: { timeoutMs: 1000, errorThresholdPercentage: 50, resetTimeoutMs: 30_000 },
      overrides: { slow: { timeoutMs: 10 } },
    };
    const overrideRegistry = new CircuitBreakerRegistry(
      overrideConfig,
      eventEmitter as unknown as EventEmitter2,
    );
    const slowThunk = () =>
      new Promise<string>((resolve) => setTimeout(() => resolve('too-late'), 50));

    await expect(overrideRegistry.wrap('slow', slowThunk)).rejects.toThrow();
  });

  it('emits CIRCUIT_BREAKER_OPENED when a provider trips open', async () => {
    const lowThresholdConfig: CircuitBreakerModuleConfig = {
      defaults: { timeoutMs: 1000, errorThresholdPercentage: 1, resetTimeoutMs: 30_000 },
    };
    const lowThresholdRegistry = new CircuitBreakerRegistry(
      lowThresholdConfig,
      eventEmitter as unknown as EventEmitter2,
    );

    await expect(
      lowThresholdRegistry.wrap('flaky-provider', async () => {
        throw new Error('down');
      }),
    ).rejects.toThrow();

    expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.CIRCUIT_BREAKER_OPENED, {
      provider: 'flaky-provider',
    });
  });

  it('emits CIRCUIT_BREAKER_CLOSED after the reset timeout elapses and a call succeeds', async () => {
    const recoveringConfig: CircuitBreakerModuleConfig = {
      defaults: { timeoutMs: 1000, errorThresholdPercentage: 1, resetTimeoutMs: 20 },
    };
    const recoveringRegistry = new CircuitBreakerRegistry(
      recoveringConfig,
      eventEmitter as unknown as EventEmitter2,
    );

    await expect(
      recoveringRegistry.wrap('recovering-provider', async () => {
        throw new Error('down');
      }),
    ).rejects.toThrow();
    expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.CIRCUIT_BREAKER_OPENED, {
      provider: 'recovering-provider',
    });

    await new Promise((resolve) => setTimeout(resolve, 40));

    await expect(recoveringRegistry.wrap('recovering-provider', async () => 'ok')).resolves.toBe(
      'ok',
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.CIRCUIT_BREAKER_CLOSED, {
      provider: 'recovering-provider',
    });
  });
});
