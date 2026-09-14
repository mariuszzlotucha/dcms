import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NegotiationApprovalService } from './negotiation-approval.service';
import { NegotiationRoleAssignment } from './entities/negotiation-role-assignment.entity';
import { ApprovalRequest } from './entities/approval-request.entity';
import { ApprovalWorkflow } from './entities/approval-workflow.entity';

describe('NegotiationApprovalService', () => {
  let roleAssignments: { findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock };
  let approvalRequests: { findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock };
  let approvalWorkflows: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let service: NegotiationApprovalService;

  beforeEach(() => {
    roleAssignments = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => data as NegotiationRoleAssignment),
      save: jest.fn(async (data) => ({ id: 'role-1', ...data }) as NegotiationRoleAssignment),
    };
    approvalRequests = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => data as ApprovalRequest),
      save: jest.fn(async (data) => ({ id: 'req-1', ...data }) as ApprovalRequest),
    };
    approvalWorkflows = {
      findOne: jest.fn(),
      create: jest.fn((data) => data as ApprovalWorkflow),
      save: jest.fn(async (data) => ({ id: 'wf-1', ...data }) as ApprovalWorkflow),
    };
    eventEmitter = { emit: jest.fn() };

    service = new NegotiationApprovalService(
      roleAssignments as never,
      approvalRequests as never,
      approvalWorkflows as never,
      eventEmitter as never,
    );
  });

  describe('assignRole', () => {
    it('creates a role assignment and emits negotiation.roleAssigned', async () => {
      roleAssignments.findOne.mockResolvedValue(null);

      const result = await service.assignRole('t1', 'c1', 'u1', 'approver');

      expect(result.id).toBe('role-1');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'negotiation.roleAssigned',
        expect.objectContaining({ contractId: 'c1', tenantId: 't1', userId: 'u1', role: 'approver' }),
      );
    });

    it('upserts (re-assigns) an existing role for the same user on the same contract', async () => {
      const existing = { id: 'role-1', tenantId: 't1', contractId: 'c1', userId: 'u1', role: 'reviewer' };
      roleAssignments.findOne.mockResolvedValue(existing);

      await service.assignRole('t1', 'c1', 'u1', 'approver');

      expect(roleAssignments.create).not.toHaveBeenCalled();
      expect(roleAssignments.save).toHaveBeenCalledWith(expect.objectContaining({ role: 'approver' }));
    });
  });

  describe('requestRevision', () => {
    it('emits negotiation.revisionRequested when the requester has a role on the contract', async () => {
      roleAssignments.findOne.mockResolvedValue({ id: 'role-1', role: 'reviewer' });

      await service.requestRevision('t1', 'c1', 'u1', 'please fix section 3');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'negotiation.revisionRequested',
        expect.objectContaining({ contractId: 'c1', tenantId: 't1', requestedBy: 'u1', comment: 'please fix section 3' }),
      );
    });

    it('rejects a revision request from a user with no role on the contract', async () => {
      roleAssignments.findOne.mockResolvedValue(null);

      await expect(service.requestRevision('t1', 'c1', 'stranger', 'x')).rejects.toBeInstanceOf(ForbiddenException);
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('createApprovalRequestForSubmission', () => {
    it('creates a pending approval request for the latest assigned approver and emits approval.requested', async () => {
      roleAssignments.findOne.mockResolvedValue({ userId: 'approver-1', role: 'approver' });
      approvalRequests.findOne.mockResolvedValue(null);

      await service.createApprovalRequestForSubmission('t1', 'c1');

      expect(approvalRequests.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 't1', contractId: 'c1', approverId: 'approver-1', status: 'pending' }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'approval.requested',
        expect.objectContaining({ contractId: 'c1', tenantId: 't1', approverId: 'approver-1' }),
      );
    });

    it('does nothing when no approver has been assigned yet', async () => {
      roleAssignments.findOne.mockResolvedValue(null);

      await service.createApprovalRequestForSubmission('t1', 'c1');

      expect(approvalRequests.create).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('does not duplicate an already-pending request for the same approver', async () => {
      roleAssignments.findOne.mockResolvedValue({ userId: 'approver-1', role: 'approver' });
      approvalRequests.findOne.mockResolvedValue({ id: 'req-existing', status: 'pending' });

      await service.createApprovalRequestForSubmission('t1', 'c1');

      expect(approvalRequests.create).not.toHaveBeenCalled();
    });
  });

  describe('grantApproval', () => {
    it('grants a pending request belonging to the approver and emits approval.granted', async () => {
      approvalRequests.findOne.mockResolvedValue({ id: 'req-1', status: 'pending' });

      const result = await service.grantApproval('t1', 'c1', 'approver-1');

      expect(result.status).toBe('granted');
      expect(approvalRequests.findOne).toHaveBeenCalledWith({
        where: { tenantId: 't1', contractId: 'c1', approverId: 'approver-1', status: 'pending' },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'approval.granted',
        expect.objectContaining({ contractId: 'c1', tenantId: 't1', approverId: 'approver-1' }),
      );
    });

    it('throws NotFound when the caller has no pending request (wrong approver or already decided)', async () => {
      approvalRequests.findOne.mockResolvedValue(null);

      await expect(service.grantApproval('t1', 'c1', 'not-the-approver')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('rejectApproval', () => {
    it('rejects a pending request with a reason and emits approval.rejected', async () => {
      approvalRequests.findOne.mockResolvedValue({ id: 'req-1', status: 'pending' });

      const result = await service.rejectApproval('t1', 'c1', 'approver-1', 'missing indemnity clause');

      expect(result.status).toBe('rejected');
      expect(result.reason).toBe('missing indemnity clause');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'approval.rejected',
        expect.objectContaining({
          contractId: 'c1',
          tenantId: 't1',
          approverId: 'approver-1',
          reason: 'missing indemnity clause',
        }),
      );
    });
  });

  describe('seedDefaultWorkflow', () => {
    it('seeds a single-stage workflow for a new tenant', async () => {
      approvalWorkflows.findOne.mockResolvedValue(null);

      await service.seedDefaultWorkflow('t1');

      expect(approvalWorkflows.create).toHaveBeenCalledWith({ tenantId: 't1', stages: 1 });
    });

    it('does not re-seed a tenant that already has a workflow', async () => {
      approvalWorkflows.findOne.mockResolvedValue({ id: 'wf-1', tenantId: 't1', stages: 1 });

      await service.seedDefaultWorkflow('t1');

      expect(approvalWorkflows.create).not.toHaveBeenCalled();
    });
  });
});
