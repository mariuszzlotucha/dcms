import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { SESSIONS_MODULE_CONFIG, SessionsModuleConfig } from '../sessions.config';

export type RequestWithRefreshToken = Request & { refreshToken: string };

/**
 * A guard, not a DTO: the token may arrive as an httpOnly cookie (browser
 * clients, once sessions move to cookies) or in the JSON body (mobile/API
 * clients), and param-level validation can't express "either of these two
 * sources". The cookie wins when both are present.
 */
@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(
    @Inject(SESSIONS_MODULE_CONFIG)
    private readonly config: SessionsModuleConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { refreshToken?: string }>();

    const fromCookie = (req.cookies as Record<string, string> | undefined)?.refreshToken;
    const body = req.body as { refreshToken?: unknown } | undefined;
    const fromBody = typeof body?.refreshToken === 'string' ? body.refreshToken : undefined;

    // A cookie-sourced token is exactly the CSRF-forgeable case (a browser
    // attaches cookies to cross-site requests automatically) — CSRF
    // protection must be active before this path is trusted. The JSON-body
    // path is unaffected: no browser auto-attaches a request body.
    if (fromCookie !== undefined && !this.config.csrfEnabled) {
      throw new ForbiddenException(
        'Cookie-based refresh tokens require CSRF protection to be enabled',
      );
    }

    const token = fromCookie ?? fromBody;
    if (!token) {
      throw new UnauthorizedException('Refresh token is required');
    }

    req.refreshToken = token;
    return true;
  }
}
