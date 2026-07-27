import { ModuleMetadata } from '@nestjs/common';

export interface SessionsModuleConfig {
  refreshTokenExpiresIn: string;
  /**
   * Deviation from the spec'd config shape, flagged on delivery: rotation
   * must return a new access token, but this module cannot reach
   * AUTH_MODULE_CONFIG (auth's dynamic module is not global and must not
   * change). Defaults to '15m' — keep in sync with auth's jwtExpiresIn.
   */
  accessTokenExpiresIn?: string;
}

export interface SessionsModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (
    ...args: any[]
  ) => Promise<SessionsModuleConfig> | SessionsModuleConfig;
  inject?: any[];
}

export const SESSIONS_MODULE_CONFIG = Symbol('SESSIONS_MODULE_CONFIG');
