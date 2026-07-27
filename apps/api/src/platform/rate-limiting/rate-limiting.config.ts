export interface RateLimitingModuleConfig {
  ttlMs: number;
  limit: number;
}

export interface RateLimitConfig {
  limit: number;
}

export const RATE_LIMIT_CONFIG = 'RATE_LIMIT_CONFIG';
