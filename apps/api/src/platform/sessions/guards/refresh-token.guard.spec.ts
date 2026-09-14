import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { RefreshTokenGuard } from './refresh-token.guard';
import { SessionsModuleConfig } from '../sessions.config';

describe('RefreshTokenGuard', () => {
  const buildContext = (req: Record<string, unknown>): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
    }) as unknown as ExecutionContext;

  const buildGuard = (config: SessionsModuleConfig) => new RefreshTokenGuard(config);

  it('accepts a body-sourced token regardless of CSRF being disabled', () => {
    const guard = buildGuard({ refreshTokenExpiresIn: '30d', csrfEnabled: false });
    const req: Record<string, unknown> = { cookies: {}, body: { refreshToken: 'rt-1' } };

    expect(guard.canActivate(buildContext(req))).toBe(true);
    expect(req.refreshToken).toBe('rt-1');
  });

  it('refuses a cookie-sourced token when CSRF protection is disabled', () => {
    const guard = buildGuard({ refreshTokenExpiresIn: '30d', csrfEnabled: false });
    const req = { cookies: { refreshToken: 'rt-1' }, body: {} };

    expect(() => guard.canActivate(buildContext(req))).toThrow(ForbiddenException);
  });

  it('accepts a cookie-sourced token once CSRF protection is enabled', () => {
    const guard = buildGuard({ refreshTokenExpiresIn: '30d', csrfEnabled: true });
    const req: Record<string, unknown> = { cookies: { refreshToken: 'rt-1' }, body: {} };

    expect(guard.canActivate(buildContext(req))).toBe(true);
    expect(req.refreshToken).toBe('rt-1');
  });

  it('still requires a token from somewhere', () => {
    const guard = buildGuard({ refreshTokenExpiresIn: '30d', csrfEnabled: true });
    const req = { cookies: {}, body: {} };

    expect(() => guard.canActivate(buildContext(req))).toThrow(UnauthorizedException);
  });
});
