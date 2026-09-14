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
  /**
   * Same cross-module-config-threading pattern as accessTokenExpiresIn
   * above: this module cannot reach SecurityModule's CsrfService directly
   * (not global, no dependency edge between security and sessions), so the
   * one bit it actually needs — is CSRF protection active — is threaded
   * through here instead. Must be kept equal to SecurityModuleConfig's
   * csrf.enabled at the app.module.ts call site.
   *
   * RefreshTokenGuard refuses a cookie-sourced refresh token whenever this
   * is false: a refresh token arriving by cookie only becomes forgeable
   * once something actually sets that cookie, and CSRF protection is what
   * closes that forgery — so the day session storage moves to cookies,
   * leaving this false turns into a hard failure instead of a silent gap.
   */
  csrfEnabled: boolean;
}

export interface SessionsModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (
    ...args: any[]
  ) => Promise<SessionsModuleConfig> | SessionsModuleConfig;
  inject?: any[];
}

export const SESSIONS_MODULE_CONFIG = Symbol('SESSIONS_MODULE_CONFIG');
