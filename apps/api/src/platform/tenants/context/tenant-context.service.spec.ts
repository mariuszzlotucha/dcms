import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { RbacService } from '@platform/rbac/rbac.service';
import { TenantContextService } from './tenant-context.service';

describe('TenantContextService', () => {
  let rbacService: { isMember: jest.Mock };

  const buildService = async (request: Record<string, unknown>) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantContextService,
        { provide: REQUEST, useValue: request },
        { provide: RbacService, useValue: rbacService },
      ],
    }).compile();

    return module.resolve(TenantContextService);
  };

  beforeEach(() => {
    rbacService = { isMember: jest.fn() };
  });

  it('returns the tenant id when the header is present and the user is a member', async () => {
    rbacService.isMember.mockResolvedValue(true);
    const service = await buildService({
      headers: { 'x-tenant-id': 't1' },
      user: { userId: 'u1' },
    });

    await expect(service.getTenantId()).resolves.toBe('t1');
    expect(rbacService.isMember).toHaveBeenCalledWith('u1', 't1');
  });

  it('throws Unauthorized when the header is missing', async () => {
    const service = await buildService({ headers: {}, user: { userId: 'u1' } });

    await expect(service.getTenantId()).rejects.toBeInstanceOf(UnauthorizedException);
    expect(rbacService.isMember).not.toHaveBeenCalled();
  });

  it('throws Unauthorized when the header is repeated (array)', async () => {
    const service = await buildService({
      headers: { 'x-tenant-id': ['t1', 't2'] },
      user: { userId: 'u1' },
    });

    await expect(service.getTenantId()).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws Unauthorized when there is no authenticated user', async () => {
    const service = await buildService({ headers: { 'x-tenant-id': 't1' } });

    await expect(service.getTenantId()).rejects.toBeInstanceOf(UnauthorizedException);
    expect(rbacService.isMember).not.toHaveBeenCalled();
  });

  it('throws Forbidden when the user is authenticated but not a member of the claimed tenant', async () => {
    rbacService.isMember.mockResolvedValue(false);
    const service = await buildService({
      headers: { 'x-tenant-id': 'victim-tenant' },
      user: { userId: 'attacker' },
    });

    await expect(service.getTenantId()).rejects.toBeInstanceOf(ForbiddenException);
  });
});
