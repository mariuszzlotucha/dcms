import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PLATFORM_EVENTS } from '../../events';
import { CsrfGuard } from './csrf.guard';
import { CsrfService } from '../csrf/csrf.service';

describe('CsrfGuard', () => {
  let csrfService: { enabled: boolean; validateRequest: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let guard: CsrfGuard;

  const buildContext = (req: object, type: 'http' | 'rpc' = 'http'): ExecutionContext =>
    ({
      getType: () => type,
      switchToHttp: () => ({ getRequest: () => req }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    csrfService = { enabled: true, validateRequest: jest.fn() };
    eventEmitter = { emit: jest.fn() };
    guard = new CsrfGuard(
      csrfService as unknown as CsrfService,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  it('passes through when csrf is disabled entirely', () => {
    csrfService.enabled = false;

    expect(guard.canActivate(buildContext({}))).toBe(true);
  });

  it('passes through for non-http execution contexts', () => {
    expect(guard.canActivate(buildContext({}, 'rpc'))).toBe(true);
  });

  it('throws a plain Error when cookie-parser is not registered (req.cookies undefined)', () => {
    const context = buildContext({ cookies: undefined, method: 'POST' });

    expect(() => guard.canActivate(context)).toThrow(
      'CsrfGuard requires cookie-parser: add app.use(cookieParser()) in main.ts',
    );
  });

  it.each(['GET', 'HEAD', 'OPTIONS'])(
    'passes through safe method %s without validating',
    (method) => {
      const context = buildContext({ cookies: {}, method });

      expect(guard.canActivate(context)).toBe(true);
      expect(csrfService.validateRequest).not.toHaveBeenCalled();
    },
  );

  it('passes through a state-changing request with a valid CSRF token', () => {
    csrfService.validateRequest.mockReturnValue(true);
    const context = buildContext({ cookies: {}, method: 'POST' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a state-changing request with an invalid CSRF token', () => {
    csrfService.validateRequest.mockReturnValue(false);
    const req = { cookies: {}, method: 'POST', path: '/api/contracts', ip: '203.0.113.5' };
    const context = buildContext(req);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.SECURITY_REQUEST_REJECTED, {
      reason: 'csrf',
      path: '/api/contracts',
      ip: '203.0.113.5',
    });
  });

  it('falls back to an empty string ip when rejecting without req.ip', () => {
    csrfService.validateRequest.mockReturnValue(false);
    const req = { cookies: {}, method: 'POST', path: '/api/contracts' };
    const context = buildContext(req);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      PLATFORM_EVENTS.SECURITY_REQUEST_REJECTED,
      expect.objectContaining({ ip: '' }),
    );
  });
});
