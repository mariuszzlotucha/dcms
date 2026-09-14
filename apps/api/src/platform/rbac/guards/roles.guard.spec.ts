import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { RbacService } from '../rbac.service';

describe('RolesGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let rbacService: { isMember: jest.Mock; hasRole: jest.Mock };
  let guard: RolesGuard;

  const buildContext = (request: Record<string, unknown>): ExecutionContext =>
    ({
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    rbacService = { isMember: jest.fn(), hasRole: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector, rbacService as unknown as RbacService);
  });

  it('allows the request through when no roles are required', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(buildContext({}))).resolves.toBe(true);
    expect(rbacService.isMember).not.toHaveBeenCalled();
  });

  it('throws Unauthorized when there is no authenticated user', async () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const context = buildContext({ headers: { 'x-tenant-id': 't1' } });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws Unauthorized when the tenant header is missing', async () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const context = buildContext({ headers: {}, user: { userId: 'u1' } });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(rbacService.isMember).not.toHaveBeenCalled();
  });

  it('throws Unauthorized when the tenant header is repeated (arrives as an array)', async () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const context = buildContext({ headers: { 'x-tenant-id': ['t1', 't2'] }, user: { userId: 'u1' } });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(rbacService.isMember).not.toHaveBeenCalled();
  });

  it('throws Forbidden when the user is not a member of the claimed tenant, even for the lowest role', async () => {
    reflector.getAllAndOverride.mockReturnValue(['member']);
    rbacService.isMember.mockResolvedValue(false);
    const context = buildContext({
      headers: { 'x-tenant-id': 'victim-tenant' },
      user: { userId: 'attacker' },
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(rbacService.hasRole).not.toHaveBeenCalled();
  });

  it('denies when the member lacks a sufficient role', async () => {
    reflector.getAllAndOverride.mockReturnValue(['owner', 'admin']);
    rbacService.isMember.mockResolvedValue(true);
    rbacService.hasRole.mockResolvedValue(false);
    const context = buildContext({
      headers: { 'x-tenant-id': 't1' },
      user: { userId: 'u1' },
    });

    await expect(guard.canActivate(context)).resolves.toBe(false);
  });

  it('allows when the member satisfies at least one required role', async () => {
    reflector.getAllAndOverride.mockReturnValue(['owner', 'admin']);
    rbacService.isMember.mockResolvedValue(true);
    rbacService.hasRole.mockImplementation((_u: string, _t: string, role: string) =>
      Promise.resolve(role === 'admin'),
    );
    const context = buildContext({
      headers: { 'x-tenant-id': 't1' },
      user: { userId: 'u1' },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
