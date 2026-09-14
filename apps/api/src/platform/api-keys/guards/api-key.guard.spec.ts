import { createHash } from 'crypto';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKey } from '../entities/api-key.entity';

describe('ApiKeyGuard', () => {
  let apiKeys: { findOne: jest.Mock };
  let guard: ApiKeyGuard;

  const buildContext = (request: Record<string, unknown>): ExecutionContext =>
    ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext;

  beforeEach(() => {
    apiKeys = { findOne: jest.fn() };
    guard = new ApiKeyGuard(apiKeys as never);
  });

  it('rejects a request with no x-api-key header', async () => {
    await expect(guard.canActivate(buildContext({ headers: {} }))).rejects.toThrow(UnauthorizedException);
    expect(apiKeys.findOne).not.toHaveBeenCalled();
  });

  it('rejects a request where x-api-key arrives as an array (repeated header)', async () => {
    await expect(
      guard.canActivate(buildContext({ headers: { 'x-api-key': ['a', 'b'] } })),
    ).rejects.toThrow(UnauthorizedException);
    expect(apiKeys.findOne).not.toHaveBeenCalled();
  });

  it('looks up the key by its sha256 hash, scoped to non-revoked keys', async () => {
    apiKeys.findOne.mockResolvedValue({ id: 'k1', tenantId: 't1' } as ApiKey);
    const rawKey = 'dcms_live_abc123';

    await guard.canActivate(buildContext({ headers: { 'x-api-key': rawKey } }));

    const expectedHash = createHash('sha256').update(rawKey).digest('hex');
    expect(apiKeys.findOne).toHaveBeenCalledWith({ where: { keyHash: expectedHash, revokedAt: IsNull() } });
  });

  it('rejects an unknown or revoked key', async () => {
    apiKeys.findOne.mockResolvedValue(null);

    await expect(
      guard.canActivate(buildContext({ headers: { 'x-api-key': 'bogus' } })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('attaches the resolved tenantId to the request and allows the request through', async () => {
    apiKeys.findOne.mockResolvedValue({ id: 'k1', tenantId: 't1' } as ApiKey);
    const request: Record<string, unknown> = { headers: { 'x-api-key': 'dcms_live_abc123' } };

    const result = await guard.canActivate(buildContext(request));

    expect(result).toBe(true);
    expect(request.tenantId).toBe('t1');
  });
});
