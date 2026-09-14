import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RbacService } from '@platform/rbac/rbac.service';
import { PLATFORM_EVENTS } from '../events';
import { TenantsService } from './tenants.service';
import { TenantsModuleConfig } from './tenants.config';
import { Tenant } from './entities/tenant.entity';

describe('TenantsService', () => {
  let tenants: { save: jest.Mock; create: jest.Mock; findOne: jest.Mock };
  let rbacService: { assignRole: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let service: TenantsService;

  const config: TenantsModuleConfig = { defaultPlan: 'free' };

  beforeEach(() => {
    tenants = {
      save: jest.fn(async (data) => ({ id: 't1', ...data }) as Tenant),
      create: jest.fn((data) => data),
      findOne: jest.fn(),
    };
    rbacService = { assignRole: jest.fn() };
    eventEmitter = { emit: jest.fn() };

    service = new TenantsService(
      tenants as never,
      config,
      rbacService as unknown as RbacService,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  describe('createTenant', () => {
    it('creates the tenant with the configured default plan', async () => {
      await service.createTenant('Acme Inc', 'u1');

      expect(tenants.create).toHaveBeenCalledWith({ name: 'Acme Inc', plan: 'free' });
    });

    it('assigns the creator as owner of the new tenant', async () => {
      await service.createTenant('Acme Inc', 'u1');

      expect(rbacService.assignRole).toHaveBeenCalledWith('u1', 't1', 'owner');
    });

    it('emits TENANT_CREATED with the saved tenant details', async () => {
      const tenant = await service.createTenant('Acme Inc', 'u1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.TENANT_CREATED, {
        tenantId: 't1',
        name: 'Acme Inc',
        plan: 'free',
      });
      expect(tenant).toEqual(expect.objectContaining({ id: 't1', name: 'Acme Inc', plan: 'free' }));
    });
  });

  describe('getTenant', () => {
    it('returns the tenant when found', async () => {
      tenants.findOne.mockResolvedValue({ id: 't1', name: 'Acme Inc', plan: 'free' });

      await expect(service.getTenant('t1')).resolves.toEqual({
        id: 't1',
        name: 'Acme Inc',
        plan: 'free',
      });
    });

    it('throws NotFoundException when the tenant does not exist', async () => {
      tenants.findOne.mockResolvedValue(null);

      await expect(service.getTenant('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
