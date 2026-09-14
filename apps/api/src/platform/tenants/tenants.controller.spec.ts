import { NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { RbacService } from '@platform/rbac/rbac.service';

describe('TenantsController', () => {
  let tenantsService: { getTenant: jest.Mock; createTenant: jest.Mock };
  let rbacService: { isMember: jest.Mock };
  let controller: TenantsController;

  const requestAs = (userId: string): Request => ({ user: { userId } }) as unknown as Request;

  beforeEach(() => {
    tenantsService = { getTenant: jest.fn(), createTenant: jest.fn() };
    rbacService = { isMember: jest.fn() };
    controller = new TenantsController(
      tenantsService as unknown as TenantsService,
      rbacService as unknown as RbacService,
    );
  });

  it('returns the tenant when the caller is a member', async () => {
    rbacService.isMember.mockResolvedValue(true);
    tenantsService.getTenant.mockResolvedValue({ id: 't1', name: 'Acme', plan: 'free' });

    await expect(controller.getTenant('t1', requestAs('u1'))).resolves.toEqual({
      id: 't1',
      name: 'Acme',
      plan: 'free',
    });
  });

  it('throws NotFound (not Forbidden) when the caller is not a member, so tenant existence is not leaked', async () => {
    rbacService.isMember.mockResolvedValue(false);

    await expect(
      controller.getTenant('victim-tenant', requestAs('attacker')),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tenantsService.getTenant).not.toHaveBeenCalled();
  });
});
