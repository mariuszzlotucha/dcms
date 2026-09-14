import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EVENTS, EventPayloadMap } from '@';
import { NegotiationApprovalService } from './negotiation-approval.service';

@Injectable()
export class NegotiationApprovalListener {
  constructor(private readonly negotiationApprovalService: NegotiationApprovalService) {}

  // architecture doc 1.3 / 3: "tenant.created — initializes a default
  // approval workflow (e.g. single-stage) for a new tenant."
  @OnEvent(EVENTS.TENANT_CREATED)
  async handleTenantCreated(event: EventPayloadMap[typeof EVENTS.TENANT_CREATED]): Promise<void> {
    await this.negotiationApprovalService.seedDefaultWorkflow(event.tenantId);
  }

  // architecture doc 1.3: "Listens to (domain): contract.submittedForApproval
  // (from contracts)."
  @OnEvent(EVENTS.CONTRACT_SUBMITTED_FOR_APPROVAL)
  async handleContractSubmittedForApproval(
    event: EventPayloadMap[typeof EVENTS.CONTRACT_SUBMITTED_FOR_APPROVAL],
  ): Promise<void> {
    await this.negotiationApprovalService.createApprovalRequestForSubmission(
      event.tenantId,
      event.contractId,
    );
  }

  // architecture doc 1.3 / 3: "auth.user.registered — allows assigning a new
  // user as a potential reviewer/approver in the organization." No seed
  // action follows from this — registering makes a user *eligible* to be
  // assigned a role later via assignRole(), it doesn't create any row by
  // itself. Deliberately not wired as an @OnEvent handler: there is nothing
  // for it to do.
}
