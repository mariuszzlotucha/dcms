import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

export type RequestWithRefreshToken = Request & { refreshToken: string };

/**
 * A guard, not a DTO: the token may arrive as an httpOnly cookie (browser
 * clients, once sessions move to cookies) or in the JSON body (mobile/API
 * clients), and param-level validation can't express "either of these two
 * sources". The cookie wins when both are present.
 */
@Injectable()
export class RefreshTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { refreshToken?: string }>();

    const fromCookie = (req.cookies as Record<string, string> | undefined)
      ?.refreshToken;
    const body = req.body as { refreshToken?: unknown } | undefined;
    const fromBody =
      typeof body?.refreshToken === 'string' ? body.refreshToken : undefined;

    const token = fromCookie ?? fromBody;
    if (!token) {
      throw new UnauthorizedException('Refresh token is required');
    }

    req.refreshToken = token;
    return true;
  }
}
