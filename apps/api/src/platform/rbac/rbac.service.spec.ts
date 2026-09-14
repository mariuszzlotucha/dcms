import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PLATFORM_EVENTS } from '../events';
import { RbacService } from './rbac.service';
import { RoleAssignment } from './entities/role-assignment.entity';
import { RBAC_MODULE_CONFIG } from './rbac.config';

describe('RbacService', () => {
  let service: RbacService;
  let roleAssignments: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    roleAssignments = {
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => ({ id: 'a1', ...data }) as RoleAssignment),
    };
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacService,
        { provide: getRepositoryToken(RoleAssignment), useValue: roleAssignments },
        { provide: RBAC_MODULE_CONFIG, useValue: { defaultRole: 'member' } },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get(RbacService);
  });

  describe('assignRole', () => {
    it('creates a new assignment when none exists yet', async () => {
      roleAssignments.findOne.mockResolvedValue(null);

      await service.assignRole('u1', 't1', 'admin');

      expect(roleAssignments.create).toHaveBeenCalledWith({ userId: 'u1', tenantId: 't1', role: 'admin' });
      expect(roleAssignments.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', tenantId: 't1', role: 'admin' }),
      );
    });

    it('updates the existing assignment in place instead of creating a duplicate', async () => {
      const existing = { id: 'a1', userId: 'u1', tenantId: 't1', role: 'member' };
      roleAssignments.findOne.mockResolvedValue(existing);

      await service.assignRole('u1', 't1', 'owner');

      expect(roleAssignments.create).not.toHaveBeenCalled();
      expect(roleAssignments.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1', role: 'owner' }));
    });

    it('emits RBAC_ROLE_ASSIGNED with the new role', async () => {
      roleAssignments.findOne.mockResolvedValue(null);

      await service.assignRole('u1', 't1', 'admin');

      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.RBAC_ROLE_ASSIGNED, {
        userId: 'u1',
        tenantId: 't1',
        role: 'admin',
      });
    });
  });

  describe('getRole', () => {
    it('returns the assigned role when one exists', async () => {
      roleAssignments.findOne.mockResolvedValue({ role: 'owner' });

      await expect(service.getRole('u1', 't1')).resolves.toBe('owner');
    });

    it('falls back to the configured default role when no assignment exists', async () => {
      roleAssignments.findOne.mockResolvedValue(null);

      await expect(service.getRole('u1', 't1')).resolves.toBe('member');
    });
  });

  describe('isMember', () => {
    it('returns true when a role assignment exists', async () => {
      roleAssignments.findOne.mockResolvedValue({ id: 'a1', userId: 'u1', tenantId: 't1', role: 'member' });

      await expect(service.isMember('u1', 't1')).resolves.toBe(true);
    });

    it('returns false when no role assignment exists, regardless of the configured default role', async () => {
      roleAssignments.findOne.mockResolvedValue(null);

      await expect(service.isMember('u1', 't1')).resolves.toBe(false);
    });
  });

  describe('hasRole', () => {
    it('falls back to the configured default role only for ranking, not membership', async () => {
      roleAssignments.findOne.mockResolvedValue(null);

      await expect(service.hasRole('u1', 't1', 'member')).resolves.toBe(true);
      await expect(service.hasRole('u1', 't1', 'admin')).resolves.toBe(false);
    });
  });
});
