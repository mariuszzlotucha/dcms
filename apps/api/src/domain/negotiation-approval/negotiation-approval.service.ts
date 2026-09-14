import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EVENTS, EventPayloadMap } from '@';
import type { NegotiationRole } from '@contracts/negotiation-approval.schema';
import { ApprovalWorkflow } from './entities/approval-workflow.entity';
import { ApprovalRequest } from './entities/approval-request.entity';
import { NegotiationRoleAssignment } from './entities/negotiation-role-assignment.entity';

const DEFAULT_WORKFLOW_STAGES = 1;

@Injectable()
export class NegotiationApprovalService {
  constructor(
    @InjectRepository(NegotiationRoleAssignment)
    private readonly roleAssignments: Repository<NegotiationRoleAssignment>,
    @InjectRepository(ApprovalRequest)
    private readonly approvalRequests: Repository<ApprovalRequest>,
    @InjectRepository(ApprovalWorkflow)
    private readonly approvalWorkflows: Repository<ApprovalWorkflow>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async assignRole(
    tenantId: string,
    contractId: string,
    userId: string,
    role: NegotiationRole,
  ): Promise<NegotiationRoleAssignment> {
    let assignment = await this.roleAssignments.findOne({
      where: { tenantId, contractId, userId },
    });

    if (assignment) {
      assignment.role = role;
    } else {
      assignment = this.roleAssignments.create({ tenantId, contractId, userId, role });
    }

    const saved = await this.roleAssignments.save(assignment);

    this.eventEmitter.emit(EVENTS.NEGOTIATION_ROLE_ASSIGNED, {
      contractId,
      tenantId,
      userId,
      role,
    } satisfies EventPayloadMap[typeof EVENTS.NEGOTIATION_ROLE_ASSIGNED]);

    return saved;
  }

  async listRoles(tenantId: string, contractId: string): Promise<NegotiationRoleAssignment[]> {
    return this.roleAssignments.find({ where: { tenantId, contractId } });
  }

  async requestRevision(
    tenantId: string,
    contractId: string,
    requestedBy: string,
    comment: string,
  ): Promise<void> {
    const isParticipant = await this.roleAssignments.findOne({
      where: { tenantId, contractId, userId: requestedBy },
    });

    if (!isParticipant) {
      throw new ForbiddenException(
        'Only a user with an assigned role on this contract can request a revision',
      );
    }

    this.eventEmitter.emit(EVENTS.NEGOTIATION_REVISION_REQUESTED, {
      contractId,
      tenantId,
      requestedBy,
      comment,
    } satisfies EventPayloadMap[typeof EVENTS.NEGOTIATION_REVISION_REQUESTED]);
  }

  async listApprovalRequests(tenantId: string, contractId: string): Promise<ApprovalRequest[]> {
    return this.approvalRequests.find({ where: { tenantId, contractId } });
  }

  async grantApproval(
    tenantId: string,
    contractId: string,
    approverId: string,
  ): Promise<ApprovalRequest> {
    const request = await this.decideApprovalRequest(tenantId, contractId, approverId, 'granted');

    this.eventEmitter.emit(EVENTS.APPROVAL_GRANTED, {
      contractId,
      tenantId,
      approverId,
    } satisfies EventPayloadMap[typeof EVENTS.APPROVAL_GRANTED]);

    return request;
  }

  async rejectApproval(
    tenantId: string,
    contractId: string,
    approverId: string,
    reason: string,
  ): Promise<ApprovalRequest> {
    const request = await this.decideApprovalRequest(
      tenantId,
      contractId,
      approverId,
      'rejected',
      reason,
    );

    this.eventEmitter.emit(EVENTS.APPROVAL_REJECTED, {
      contractId,
      tenantId,
      approverId,
      reason,
    } satisfies EventPayloadMap[typeof EVENTS.APPROVAL_REJECTED]);

    return request;
  }

  // Invoked from NegotiationApprovalListener on contract.submittedForApproval.
  // Single-stage MVP v0: only the most-recently-assigned approver gets a
  // request. Silently a no-op when no approver has been assigned yet —
  // there is no synchronous caller to report that back to (this runs off an
  // event), and re-submission (once an approver exists) will pick it up.
  async createApprovalRequestForSubmission(tenantId: string, contractId: string): Promise<void> {
    const approver = await this.roleAssignments.findOne({
      where: { tenantId, contractId, role: 'approver' },
      order: { assignedAt: 'DESC' },
    });

    if (!approver) {
      return;
    }

    const existingPending = await this.approvalRequests.findOne({
      where: { tenantId, contractId, approverId: approver.userId, status: 'pending' },
    });

    if (existingPending) {
      return;
    }

    await this.approvalRequests.save(
      this.approvalRequests.create({
        tenantId,
        contractId,
        approverId: approver.userId,
        status: 'pending',
      }),
    );

    this.eventEmitter.emit(EVENTS.APPROVAL_REQUESTED, {
      contractId,
      tenantId,
      approverId: approver.userId,
    } satisfies EventPayloadMap[typeof EVENTS.APPROVAL_REQUESTED]);
  }

  // Invoked from NegotiationApprovalListener on tenant.created. Idempotent:
  // skips tenants that already have a workflow row.
  async seedDefaultWorkflow(tenantId: string): Promise<void> {
    const existing = await this.approvalWorkflows.findOne({ where: { tenantId } });

    if (existing) {
      return;
    }

    await this.approvalWorkflows.save(
      this.approvalWorkflows.create({ tenantId, stages: DEFAULT_WORKFLOW_STAGES }),
    );
  }

  private async decideApprovalRequest(
    tenantId: string,
    contractId: string,
    approverId: string,
    outcome: 'granted' | 'rejected',
    reason?: string,
  ): Promise<ApprovalRequest> {
    const request = await this.approvalRequests.findOne({
      where: { tenantId, contractId, approverId, status: 'pending' },
    });

    if (!request) {
      throw new NotFoundException(
        'No pending approval request found for this approver on this contract',
      );
    }

    request.status = outcome;
    request.reason = reason ?? null;
    request.decidedAt = new Date();

    return this.approvalRequests.save(request);
  }
}
