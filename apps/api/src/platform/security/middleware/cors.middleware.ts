import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import cors from 'cors';
import { NextFunction, Request, Response } from 'express';
import { SECURITY_MODULE_CONFIG, SecurityModuleConfig } from '../security.config';
import { createCorsOptions } from '../cors/cors.config.factory';

@Injectable()
export class CorsMiddleware implements NestMiddleware {
  private readonly handler: ReturnType<typeof cors>;

  constructor(@Inject(SECURITY_MODULE_CONFIG) config: SecurityModuleConfig) {
    this.handler = cors(createCorsOptions(config));
  }

  use(req: Request, res: Response, next: NextFunction) {
    this.handler(req, res, next);
  }
}