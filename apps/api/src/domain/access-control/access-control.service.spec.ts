import { NotFoundException } from '@nestjs/common';
import { AccessControlService } from './access-control.service';
import { AccessPolicy } from './entities/access-policy.entity';
import { CollaborationInvite } from './entities/collaboration-invite.entity';
import { CollaborationSession } from './entities/collaboration-session.entity';
import { ContractAccessGrant } from './entities/contract-access-grant.entity';
import { ContractComment } from './entities/contract-comment.entity';

describe('AccessControlService', () => {
  let accessPolicies: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let accessGrants: { findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock; remove: jest.Mock };
  let invites: { find: jest.Mock; create: jest.Mock; save: jest.Mock };
  let comments: { find: jest.Mock; create: jest.Mock; save: jest.Mock };
  let sessions: { create: jest.Mock; save: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let service: AccessControlService;

  beforeEach(() => {
    accessPolicies = {
      findOne: jest.fn(),
      create: jest.fn((data) => data as AccessPolicy),
      save: jest.fn(async (data) => ({ id: 'policy-1', ...data }) as AccessPolicy),
    };
    accessGrants = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => data as ContractAccessGrant),
      save: jest.fn(async (data) => ({ id: 'grant-1', ...data }) as ContractAccessGrant),
      remove: jest.fn(),
    };
    invites = {
      find: jest.fn(),
      create: jest.fn((data) => data as CollaborationInvite),
      save: jest.fn(async (data) => ({ id: 'invite-1', ...data }) as CollaborationInvite),
    };
    comments = {
      find: jest.fn(),
      create: jest.fn((data) => data as ContractComment),
      save: jest.fn(async (data) => ({ id: 'comment-1', ...data }) as ContractComment),
    };
    sessions = {
      create: jest.fn((data) => data as CollaborationSession),
      save: jest.fn(async (data) => ({ id: 'session-1', ...data }) as CollaborationSession),
    };
    eventEmitter = { emit: jest.fn() };

    service = new AccessControlService(
      accessPolicies as never,
      accessGrants as never,
      invites as never,
      comments as never,
      sessions as never,
      eventEmitter as never,
    );
  });

  describe('grantAccess', () => {
    it('creates a grant and emits access.granted', async () => {
      accessGrants.findOne.mockResolvedValue(null);

      const result = await service.grantAccess('t1', 'c1', 'u1', 'edit', 'admin-1');

      expect(result.id).toBe('grant-1');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'access.granted',
        expect.objectContaining({ contractId: 'c1', tenantId: 't1', userId: 'u1', permission: 'edit' }),
      );
    });

    it('upserts (re-grants) an existing grant for the same user on the same contract', async () => {
      accessGrants.findOne.mockResolvedValue({ id: 'grant-1', permission: 'view' });

      await service.grantAccess('t1', 'c1', 'u1', 'edit', 'admin-1');

      expect(accessGrants.create).not.toHaveBeenCalled();
      expect(accessGrants.save).toHaveBeenCalledWith(expect.objectContaining({ permission: 'edit' }));
    });
  });

  describe('revokeAccess', () => {
    it('removes an existing grant and emits access.revoked', async () => {
      accessGrants.findOne.mockResolvedValue({ id: 'grant-1', tenantId: 't1', contractId: 'c1', userId: 'u1' });

      await service.revokeAccess('t1', 'c1', 'u1');

      expect(accessGrants.remove).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'access.revoked',
        expect.objectContaining({ contractId: 'c1', tenantId: 't1', userId: 'u1' }),
      );
    });

    it('throws NotFound when there is no grant to revoke', async () => {
      accessGrants.findOne.mockResolvedValue(null);

      await expect(service.revokeAccess('t1', 'c1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('inviteParticipant', () => {
    it('creates a pending invite and emits collaboration.participantInvited', async () => {
      const result = await service.inviteParticipant('t1', 'c1', 'stranger@example.com', 'comment', 'admin-1');

      expect(result.id).toBe('invite-1');
      expect(invites.create).toHaveBeenCalledWith(
        expect.objectContaining({ invitedEmail: 'stranger@example.com', permission: 'comment', resolvedAt: null }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'collaboration.participantInvited',
        expect.objectContaining({ contractId: 'c1', tenantId: 't1', invitedEmail: 'stranger@example.com', invitedBy: 'admin-1' }),
      );
    });
  });

  describe('addComment', () => {
    it('creates a comment and emits collaboration.commentAdded', async () => {
      const result = await service.addComment('t1', 'c1', 'u1', 'looks good');

      expect(result.id).toBe('comment-1');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'collaboration.commentAdded',
        expect.objectContaining({ contractId: 'c1', tenantId: 't1', commentId: 'comment-1', authorId: 'u1' }),
      );
    });
  });

  describe('startSession', () => {
    it('creates a session and emits collaboration.sessionStarted', async () => {
      const result = await service.startSession('t1', 'c1', 'u1');

      expect(result.id).toBe('session-1');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'collaboration.sessionStarted',
        expect.objectContaining({ contractId: 'c1', tenantId: 't1', userId: 'u1' }),
      );
    });
  });

  describe('seedDefaultAccessPolicy', () => {
    it('seeds a default view policy for a new tenant', async () => {
      accessPolicies.findOne.mockResolvedValue(null);

      await service.seedDefaultAccessPolicy('t1');

      expect(accessPolicies.create).toHaveBeenCalledWith({ tenantId: 't1', defaultPermission: 'view' });
    });

    it('does not re-seed a tenant that already has a policy', async () => {
      accessPolicies.findOne.mockResolvedValue({ id: 'policy-1' });

      await service.seedDefaultAccessPolicy('t1');

      expect(accessPolicies.create).not.toHaveBeenCalled();
    });
  });

  describe('resolvePendingInvites', () => {
    it('grants access for each pending invite matching the registered email and marks them resolved', async () => {
      invites.find.mockResolvedValue([
        { id: 'invite-1', contractId: 'c1', permission: 'edit', invitedBy: 'admin-1', resolvedAt: null },
        { id: 'invite-2', contractId: 'c2', permission: 'view', invitedBy: 'admin-2', resolvedAt: null },
      ]);
      accessGrants.findOne.mockResolvedValue(null);

      await service.resolvePendingInvites('t1', 'newuser@example.com', 'u1');

      expect(accessGrants.save).toHaveBeenCalledTimes(2);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'access.granted',
        expect.objectContaining({ contractId: 'c1', tenantId: 't1', userId: 'u1', permission: 'edit' }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'access.granted',
        expect.objectContaining({ contractId: 'c2', tenantId: 't1', userId: 'u1', permission: 'view' }),
      );
      expect(invites.save).toHaveBeenCalledTimes(2);
    });

    it('does nothing when there are no pending invites for the email', async () => {
      invites.find.mockResolvedValue([]);

      await service.resolvePendingInvites('t1', 'nobody@example.com', 'u1');

      expect(accessGrants.save).not.toHaveBeenCalled();
    });
  });
});
