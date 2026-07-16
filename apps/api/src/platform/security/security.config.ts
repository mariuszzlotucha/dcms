import { ModuleMetadata } from '@nestjs/common';

export interface SecurityModuleConfig {
  cors: {
    allowedOrigins: string[];
  };
  helmet?: Record<string, unknown>;
  csrf?: {
    enabled: boolean;
    /**
     * HMAC secret required by csrf-csrf when enabled. Comes straight
     * from env via forRootAsync for now — migrates to `secrets` (#4)
     * later, same path as encryption.masterKey.
     */
    secret?: string;
  };
  cookies?: {
    sameSite?: 'strict' | 'lax' | 'none';
    secure?: boolean;
  };
  encryption?: {
    masterKey: string;
  };
}

export interface SecurityModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (
    ...args: any[]
  ) => Promise<SecurityModuleConfig> | SecurityModuleConfig;
  inject?: any[];
}

export const SECURITY_MODULE_CONFIG = Symbol('SECURITY_MODULE_CONFIG');

/**
 * Central place for secure cookie defaults (httpOnly, secure, sameSite).
 * Any code setting cookies (CSRF below, sessions/auth later) should build
 * its cookie options through this instead of hardcoding flags.
 */
export function buildCookieOptions(config: SecurityModuleConfig) {
  return {
    httpOnly: true,
    secure: config.cookies?.secure ?? true,
    sameSite: config.cookies?.sameSite ?? 'lax',
  } as const;
}
