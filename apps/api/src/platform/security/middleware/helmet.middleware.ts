import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import helmet from 'helmet';
import { NextFunction, Request, Response } from 'express';
import {
  SECURITY_MODULE_CONFIG,
  SecurityModuleConfig,
} from '../security.config';

type HelmetOptions = Parameters<typeof helmet>[0];

@Injectable()
export class HelmetMiddleware implements NestMiddleware {
  private readonly handler: ReturnType<typeof helmet>;

  constructor(@Inject(SECURITY_MODULE_CONFIG) config: SecurityModuleConfig) {
    // Helmet ships sane defaults (CSP, X-Frame-Options, HSTS, ...);
    // config.helmet only overrides them when explicitly provided.
    this.handler = helmet((config.helmet ?? {}) as HelmetOptions);
  }

  use(req: Request, res: Response, next: NextFunction) {
    this.handler(req, res, next);
  }
}
