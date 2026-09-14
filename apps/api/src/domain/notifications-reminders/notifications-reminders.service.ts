import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { NotificationsService } from '@platform/notifications/notifications.service';
import { EVENTS, EventPayloadMap } from '@';
import type { ReminderType } from '@contracts/notifications-reminders.schema';
import { Reminder } from './entities/reminder.entity';

const DAY_MS = 24 * 60 * 60 * 1000;
const PENDING_REVIEW_DELAY_MS = 3 * DAY_MS;
const PENDING_APPROVAL_DELAY_MS = 2 * DAY_MS;
const PENDING_SIGNATURE_DELAY_MS = 3 * DAY_MS;

@Injectable()
export class NotificationsRemindersService {
  constructor(
    @InjectRepository(Reminder)
    private readonly reminders: Repository<Reminder>,
    private readonly notificationsService: NotificationsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // architecture doc 1.8: "reminders for expiring contracts, pending
  // signatures, approval statuses" — only the negotiation stage has a real
  // stalling signal here. `approved` is covered once esignature.sent
  // actually fires (scheduleSignatureReminder), and there is no
  // Contract#expiresAt field yet for real expiry reminders (out of scope
  // when `contracts` was built) — deliberately not simulated.
  async scheduleContractStageReminder(
    tenantId: string,
    contractId: string,
    newStatus: string,
  ): Promise<void> {
    await this.cancelPending(tenantId, contractId, 'pending_review');

    if (newStatus === 'negotiation') {
      await this.schedule(tenantId, contractId, 'pending_review', PENDING_REVIEW_DELAY_MS, {});
    }
  }

  async scheduleApprovalReminder(
    tenantId: string,
    contractId: string,
    approverId: string,
  ): Promise<void> {
    await this.schedule(tenantId, contractId, 'pending_approval', PENDING_APPROVAL_DELAY_MS, {
      recipientUserId: approverId,
    });
  }

  async scheduleSignatureReminder(
    tenantId: string,
    contractId: string,
    recipientEmail: string,
  ): Promise<void> {
    await this.schedule(tenantId, contractId, 'pending_signature', PENDING_SIGNATURE_DELAY_MS, {
      recipientEmail,
    });
  }

  // No assignee data on either triggering event (esignature.expired carries
  // only the envelopeId, negotiation.revisionRequested only who requested
  // the revision, not who should act on it) — dispatched immediately as a
  // tenant-wide in-app notice rather than guessing a recipient.
  async notifySignatureExpired(tenantId: string, contractId: string): Promise<void> {
    await this.scheduleImmediate(tenantId, contractId, 'signature_expired');
  }

  async notifyRevisionRequested(tenantId: string, contractId: string): Promise<void> {
    await this.scheduleImmediate(tenantId, contractId, 'revision_requested');
  }

  async listReminders(tenantId: string, contractId: string): Promise<Reminder[]> {
    return this.reminders.find({ where: { tenantId, contractId }, order: { createdAt: 'DESC' } });
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async dispatchDueReminders(): Promise<void> {
    const due = await this.reminders.find({
      where: { status: 'pending', scheduledFor: LessThanOrEqual(new Date()) },
    });

    for (const reminder of due) {
      await this.dispatch(reminder);
    }
  }

  private async schedule(
    tenantId: string,
    contractId: string,
    reminderType: ReminderType,
    delayMs: number,
    recipient: { recipientUserId?: string; recipientEmail?: string },
  ): Promise<void> {
    const scheduledFor = new Date(Date.now() + delayMs);

    await this.reminders.save(
      this.reminders.create({
        tenantId,
        contractId,
        reminderType,
        scheduledFor,
        recipientUserId: recipient.recipientUserId ?? null,
        recipientEmail: recipient.recipientEmail ?? null,
      }),
    );

    this.eventEmitter.emit(EVENTS.REMINDER_SCHEDULED, {
      tenantId,
      contractId,
      reminderType,
      scheduledFor,
    } satisfies EventPayloadMap[typeof EVENTS.REMINDER_SCHEDULED]);
  }

  private async scheduleImmediate(
    tenantId: string,
    contractId: string,
    reminderType: ReminderType,
  ): Promise<void> {
    const reminder = await this.reminders.save(
      this.reminders.create({
        tenantId,
        contractId,
        reminderType,
        scheduledFor: new Date(),
        recipientUserId: null,
        recipientEmail: null,
      }),
    );

    await this.dispatch(reminder);
  }

  private async cancelPending(
    tenantId: string,
    contractId: string,
    reminderType: ReminderType,
  ): Promise<void> {
    await this.reminders.update(
      { tenantId, contractId, reminderType, status: 'pending' },
      { status: 'cancelled' },
    );
  }

  private async dispatch(reminder: Reminder): Promise<void> {
    const channel: 'email' | 'in-app' = reminder.recipientEmail ? 'email' : 'in-app';

    if (reminder.recipientEmail) {
      await this.notificationsService.send(reminder.tenantId, reminder.recipientEmail, 'reminder', {
        contractId: reminder.contractId,
        reminderType: reminder.reminderType,
      });
    }

    reminder.status = 'sent';
    reminder.sentAt = new Date();
    await this.reminders.save(reminder);

    this.eventEmitter.emit(EVENTS.REMINDER_SENT, {
      tenantId: reminder.tenantId,
      contractId: reminder.contractId,
      reminderType: reminder.reminderType,
    } satisfies EventPayloadMap[typeof EVENTS.REMINDER_SENT]);

    this.eventEmitter.emit(EVENTS.NOTIFICATION_DISPATCHED, {
      tenantId: reminder.tenantId,
      recipient: reminder.recipientEmail ?? reminder.recipientUserId ?? reminder.tenantId,
      channel,
      template: 'reminder',
    } satisfies EventPayloadMap[typeof EVENTS.NOTIFICATION_DISPATCHED]);
  }
}
