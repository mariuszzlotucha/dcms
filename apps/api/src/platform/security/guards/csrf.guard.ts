import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Request } from 'express';
import {
  PLATFORM_EVENTS,
  PlatformEventPayloadMap,
} from '../../events';
import { CsrfService } from '../csrf/csrf.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit-cookie CSRF protection (csrf-csrf, via CsrfService). Only
 * relevant for cookie-based sessions — when csrf.enabled is false (e.g.
 * pure Bearer token API) the guard is a no-op pass-through, so it can
 * safely be registered globally via APP_GUARD regardless of config.
 *
 * RUNTIME PREREQUISITE when enabled: cookie-parser must be registered in
 * main.ts (`app.use(cookieParser())`) BEFORE the app starts handling
 * requests — csrf-csrf reads its token from req.cookies, which does not
 * exist without it, and every state-changing request would be rejected.
 * Clients obtain their token from GET /security/csrf-token.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly logger = new Logger(CsrfGuard.name);

  constructor(
    private readonly csrfService: CsrfService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.csrfService.enabled) return true;
    if (context.getType() !== 'http') return true;

    const req = context.switchToHttp().getRequest<Request>();
    if (req.cookies === undefined) {
      // Fail loudly on misconfiguration instead of silently 403-ing every
      // state-changing request with a confusing "invalid token".
      throw new Error(
        'CsrfGuard requires cookie-parser: add app.use(cookieParser()) in main.ts',
      );
    }
    if (SAFE_METHODS.has(req.method)) return true;
    if (this.csrfService.validateRequest(req)) return true;

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
