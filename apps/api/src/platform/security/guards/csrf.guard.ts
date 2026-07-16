import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { doubleCsrf } from 'csrf-csrf';
import { Request } from 'express';
import {
  PLATFORM_EVENTS,
  PlatformEventPayloadMap,
} from '../../events';
import {
  SECURITY_MODULE_CONFIG,
  SecurityModuleConfig,
  buildCookieOptions,
} from '../security.config';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);


@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly logger = new Logger(CsrfGuard.name);
  private readonly enabled: boolean;
  private readonly validateRequest?: (req: Request) => boolean;

  constructor(
    @Inject(SECURITY_MODULE_CONFIG) config: SecurityModuleConfig,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.enabled = config.csrf?.enabled ?? false;

    if (this.enabled) {
      const secret = config.csrf?.secret;
      if (!secret) {
        throw new Error(
          'SecurityModuleConfig.csrf.secret is required when csrf.enabled is true',
        );
      }
      const { validateRequest } = doubleCsrf({
        getSecret: () => secret,
        cookieOptions: buildCookieOptions(config),
      });
      this.validateRequest = validateRequest;
    }
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.enabled) return true;
    if (context.getType() !== 'http') return true;

    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;
    if (this.validateRequest!(req)) return true;

    const event = {
      reason: 'csrf',
      path: req.path,
      ip: req.ip ?? '',
    };
    this.logger.warn({ msg: 'Request rejected by CSRF guard', ...event });
    this.eventEmitter.emit(PLATFORM_EVENTS.SECURITY_REQUEST_REJECTED, event satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.SECURITY_REQUEST_REJECTED]);

    throw new ForbiddenException('Invalid CSRF token');
  }
}
