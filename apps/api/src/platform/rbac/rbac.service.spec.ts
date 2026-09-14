import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RbacService } from './rbac.service';
import { RoleAssignment } from './entities/role-assignment.entity';
import { RBAC_MODULE_CONFIG } from './rbac.config';

describe('RbacService', () => {
  let service: RbacService;
  let roleAssignments: { findOne: jest.Mock };

  beforeEach(async () => {
    roleAssignments = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacService,
        { provide: getRepositoryToken(RoleAssignment), useValue: roleAssignments },
        { provide: RBAC_MODULE_CONFIG, useValue: { defaultRole: 'member' } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get(RbacService);
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
