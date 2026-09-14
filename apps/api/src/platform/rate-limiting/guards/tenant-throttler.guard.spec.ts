import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ThrottlerException, ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';
import { PLATFORM_EVENTS } from '../../events';
import { TenantThrottlerGuard } from './tenant-throttler.guard';

// getTracker / throwThrottlingException are `protected` overrides — cast to
// access them directly rather than exercising the whole ThrottlerGuard flow.
type TestableGuard = TenantThrottlerGuard & {
  getTracker(req: Record<string, unknown>): Promise<string>;
  throwThrottlingException(context: ExecutionContext, detail: unknown): Promise<void>;
};

describe('TenantThrottlerGuard', () => {
  let tenantContext: { getTenantId: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let guard: TestableGuard;

  beforeEach(() => {
    tenantContext = { getTenantId: jest.fn() };
    eventEmitter = { emit: jest.fn() };
    guard = new TenantThrottlerGuard(
      {} as ThrottlerModuleOptions,
      {} as ThrottlerStorage,
      new Reflector(),
      tenantContext as unknown as TenantContextService,
      { limit: 100 },
      eventEmitter as unknown as EventEmitter2,
    ) as TestableGuard;
  });

  describe('getTracker', () => {
    it('uses the tenant id when tenant context resolves', async () => {
      tenantContext.getTenantId.mockResolvedValue('t1');

      await expect(guard.getTracker({ ip: '1.2.3.4' })).resolves.toBe('t1');
    });

    it('falls back to the API key id when there is no tenant context', async () => {
      tenantContext.getTenantId.mockRejectedValue(new Error('no tenant'));

      await expect(guard.getTracker({ ip: '1.2.3.4', apiKeyId: 'k1' })).resolves.toBe('k1');
    });

    it('falls back to the request IP when there is neither a tenant nor an API key', async () => {
      tenantContext.getTenantId.mockRejectedValue(new Error('no tenant'));

      await expect(guard.getTracker({ ip: '1.2.3.4' })).resolves.toBe('1.2.3.4');
    });
  });

  describe('throwThrottlingException', () => {
    const buildContext = (request: Record<string, unknown>): ExecutionContext =>
      ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext;

    it('emits RATE_LIMIT_EXCEEDED with the resolved tenant, tracker key, and configured limit', async () => {
      tenantContext.getTenantId.mockResolvedValue('t1');

      await expect(guard.throwThrottlingException(buildContext({ ip: '1.2.3.4' }), {})).rejects.toThrow(
        ThrottlerException,
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.RATE_LIMIT_EXCEEDED, {
        tenantId: 't1',
        key: 't1',
        limit: 100,
      });
    });

    it('falls back to an empty tenantId in the event when there is no tenant context', async () => {
      tenantContext.getTenantId.mockRejectedValue(new Error('no tenant'));

      await expect(guard.throwThrottlingException(buildContext({ ip: '1.2.3.4' }), {})).rejects.toThrow(
        ThrottlerException,
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.RATE_LIMIT_EXCEEDED, {
        tenantId: '',
        key: '1.2.3.4',
        limit: 100,
      });
    });

    it('still throws the throttling exception after emitting the event', async () => {
      tenantContext.getTenantId.mockResolvedValue('t1');

      await expect(guard.throwThrottlingException(buildContext({ ip: '1.2.3.4' }), {})).rejects.toThrow();
    });
  });
});
