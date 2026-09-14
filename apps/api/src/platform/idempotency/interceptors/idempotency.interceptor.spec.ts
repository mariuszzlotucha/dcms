import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyService } from '../idempotency.service';
import { IdempotencyRecord } from '../entities/idempotency-record.entity';

describe('IdempotencyInterceptor', () => {
  let idempotencyService: { findValidRecord: jest.Mock; persist: jest.Mock };
  let interceptor: IdempotencyInterceptor;
  let response: { status: jest.Mock; statusCode: number };
  let next: { handle: jest.Mock };

  const buildContext = (request: Record<string, unknown>): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    idempotencyService = { findValidRecord: jest.fn(), persist: jest.fn() };
    interceptor = new IdempotencyInterceptor(idempotencyService as unknown as IdempotencyService);
    response = { status: jest.fn(), statusCode: 200 };
    next = { handle: jest.fn() };
  });

  it('passes through untouched when no idempotency-key header is present', async () => {
    next.handle.mockReturnValue(of('handler-result'));
    const request = { headers: {}, path: '/api/contracts' };

    const result$ = await interceptor.intercept(buildContext(request), next as unknown as CallHandler);

    expect(await firstValueFrom(result$)).toBe('handler-result');
    expect(idempotencyService.findValidRecord).not.toHaveBeenCalled();
  });

  it('passes through when the idempotency-key header arrives as an array', async () => {
    next.handle.mockReturnValue(of('handler-result'));
    const request = { headers: { 'idempotency-key': ['a', 'b'] }, path: '/api/contracts' };

    await interceptor.intercept(buildContext(request), next as unknown as CallHandler);

    expect(idempotencyService.findValidRecord).not.toHaveBeenCalled();
  });

  it('replays a stored response and sets the original status code without calling the handler', async () => {
    const stored = { responseStatus: 201, responseBody: { id: 'c1' } } as IdempotencyRecord;
    idempotencyService.findValidRecord.mockResolvedValue(stored);
    const request = { headers: { 'idempotency-key': 'key-1' }, path: '/api/contracts' };

    const result$ = await interceptor.intercept(buildContext(request), next as unknown as CallHandler);

    expect(await firstValueFrom(result$)).toEqual({ id: 'c1' });
    expect(response.status).toHaveBeenCalledWith(201);
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('calls the handler and persists the response for a new idempotency key', async () => {
    idempotencyService.findValidRecord.mockResolvedValue(null);
    next.handle.mockReturnValue(of({ id: 'c1' }));
    response.statusCode = 201;
    const request = { headers: { 'idempotency-key': 'key-1' }, path: '/api/contracts' };

    const result$ = await interceptor.intercept(buildContext(request), next as unknown as CallHandler);
    expect(await firstValueFrom(result$)).toEqual({ id: 'c1' });

    expect(idempotencyService.persist).toHaveBeenCalledWith('key-1', '/api/contracts', 201, { id: 'c1' });
  });
});
