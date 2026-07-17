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

/**
 * Double-submit-cookie CSRF protection (csrf-csrf). Only relevant for
 * cookie-based sessions — when csrf.enabled is false (e.g. pure Bearer
 * token API) the guard is a no-op pass-through, so it can safely be
 * registered globally via APP_GUARD regardless of config.
 *
 * RUNTIME PREREQUISITE when enabled: cookie-parser must be registered in
 * main.ts (`app.use(cookieParser())`) BEFORE the app starts handling
 * requests — csrf-csrf reads its token from req.cookies, which does not
 * exist without it, and every state-changing request would be rejected.
 */
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
    } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.SECURITY_REQUEST_REJECTED];
    this.logger.warn({ msg: 'Request rejected by CSRF guard', ...event });
    this.eventEmitter.emit(PLATFORM_EVENTS.SECURITY_REQUEST_REJECTED, event);

    throw new ForbiddenException('Invalid CSRF token');
  }
}
