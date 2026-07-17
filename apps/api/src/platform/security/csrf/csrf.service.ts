import { Inject, Injectable } from '@nestjs/common';
import { doubleCsrf } from 'csrf-csrf';
import { Request, Response } from 'express';
import {
  SECURITY_MODULE_CONFIG,
  SecurityModuleConfig,
  buildCookieOptions,
} from '../security.config';

/**
 * Single owner of the doubleCsrf instance: CsrfGuard consumes
 * validateRequest, SecurityController consumes generateToken. Both sides
 * must share one instance (same secret + cookie options) or tokens issued
 * by one would never validate in the other.
 */
@Injectable()
export class CsrfService {
  readonly enabled: boolean;
  private readonly utils?: ReturnType<typeof doubleCsrf>;

  constructor(@Inject(SECURITY_MODULE_CONFIG) config: SecurityModuleConfig) {
    this.enabled = config.csrf?.enabled ?? false;

    if (this.enabled) {
      const secret = config.csrf?.secret;
      if (!secret) {
        throw new Error(
          'SecurityModuleConfig.csrf.secret is required when csrf.enabled is true',
        );
      }
      this.utils = doubleCsrf({
        getSecret: () => secret,
        cookieOptions: buildCookieOptions(config),
      });
    }
  }

  validateRequest(req: Request): boolean {
    return this.utils?.validateRequest(req) ?? false;
  }

  /** Generates a token and sets the double-submit cookie on the response. */
  generateToken(req: Request, res: Response): string {
    if (!this.utils) {
      throw new Error('CSRF protection is not enabled');
    }
    return this.utils.generateToken(req, res);
  }
}
