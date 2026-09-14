import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EVENTS, EventPayloadMap } from '@';
import { NotificationsRemindersService } from './notifications-reminders.service';

// architecture doc 1.8: listens to exactly these 5 domain events, nothing
// else — e.g. it does not also listen to approval.granted/rejected to
// cancel a pending_approval reminder early. "Does NOT: decide the business
// logic of the trigger" — it reacts mechanically, it doesn't verify the
// underlying condition still holds.
@Injectable()
export class NotificationsRemindersListener {
  constructor(private readonly notificationsRemindersService: NotificationsRemindersService) {}

  @OnEvent(EVENTS.CONTRACT_STATUS_CHANGED)
  async handleContractStatusChanged(
    event: EventPayloadMap[typeof EVENTS.CONTRACT_STATUS_CHANGED],
  ): Promise<void> {
    await this.notificationsRemindersService.scheduleContractStageReminder(
      event.tenantId,
      event.contractId,
      event.newStatus,
    );
  }

  @OnEvent(EVENTS.APPROVAL_REQUESTED)
  async handleApprovalRequested(event: EventPayloadMap[typeof EVENTS.APPROVAL_REQUESTED]): Promise<void> {
    await this.notificationsRemindersService.scheduleApprovalReminder(
      event.tenantId,
      event.contractId,
      event.approverId,
    );
  }

  @OnEvent(EVENTS.ESIGNATURE_SENT)
  async handleEsignatureSent(event: EventPayloadMap[typeof EVENTS.ESIGNATURE_SENT]): Promise<void> {
    await this.notificationsRemindersService.scheduleSignatureReminder(
      event.tenantId,
      event.contractId,
      event.recipientEmail,
    );
  }

  @OnEvent(EVENTS.ESIGNATURE_EXPIRED)
  async handleEsignatureExpired(event: EventPayloadMap[typeof EVENTS.ESIGNATURE_EXPIRED]): Promise<void> {
    await this.notificationsRemindersService.notifySignatureExpired(event.tenantId, event.contractId);
  }

  @OnEvent(EVENTS.NEGOTIATION_REVISION_REQUESTED)
  async handleNegotiationRevisionRequested(
    event: EventPayloadMap[typeof EVENTS.NEGOTIATION_REVISION_REQUESTED],
  ): Promise<void> {
    await this.notificationsRemindersService.notifyRevisionRequested(event.tenantId, event.contractId);
  }
}
