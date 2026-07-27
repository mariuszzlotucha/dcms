export interface CircuitBreakerModuleConfig {
  defaults: {
    timeoutMs: number;
    errorThresholdPercentage: number;
    resetTimeoutMs: number;
  };
  overrides?: Record<string, Partial<CircuitBreakerModuleConfig['defaults']>>;
}

export const CIRCUIT_BREAKER_MODULE_CONFIG = 'CIRCUIT_BREAKER_MODULE_CONFIG';
