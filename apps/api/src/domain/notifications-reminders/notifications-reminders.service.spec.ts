import { NotificationsRemindersService } from './notifications-reminders.service';
import { Reminder } from './entities/reminder.entity';

describe('NotificationsRemindersService', () => {
  let reminders: { find: jest.Mock; create: jest.Mock; save: jest.Mock; update: jest.Mock };
  let notificationsService: { send: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let service: NotificationsRemindersService;

  beforeEach(() => {
    reminders = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((data) => data as Reminder),
      save: jest.fn(async (data) => ({ id: 'reminder-1', ...data }) as Reminder),
      update: jest.fn(),
    };
    notificationsService = { send: jest.fn() };
    eventEmitter = { emit: jest.fn() };

    service = new NotificationsRemindersService(
      reminders as never,
      notificationsService as never,
      eventEmitter as never,
    );
  });

  describe('scheduleContractStageReminder', () => {
    it('cancels any pending pending_review reminder and schedules a new one when entering negotiation', async () => {
      await service.scheduleContractStageReminder('t1', 'c1', 'negotiation');

      expect(reminders.update).toHaveBeenCalledWith(
        { tenantId: 't1', contractId: 'c1', reminderType: 'pending_review', status: 'pending' },
        { status: 'cancelled' },
      );
      expect(reminders.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          contractId: 'c1',
          reminderType: 'pending_review',
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'reminder.scheduled',
        expect.objectContaining({
          tenantId: 't1',
          contractId: 'c1',
          reminderType: 'pending_review',
        }),
      );
    });

    it('only cancels, without scheduling anything, for statuses other than negotiation', async () => {
      await service.scheduleContractStageReminder('t1', 'c1', 'approved');

      expect(reminders.update).toHaveBeenCalled();
      expect(reminders.save).not.toHaveBeenCalled();
    });
  });

  it('schedules a pending_approval reminder addressed to the approver', async () => {
    await service.scheduleApprovalReminder('t1', 'c1', 'approver-1');

    expect(reminders.save).toHaveBeenCalledWith(
      expect.objectContaining({
        reminderType: 'pending_approval',
        recipientUserId: 'approver-1',
        recipientEmail: null,
      }),
    );
  });

  it('schedules a pending_signature reminder addressed to the external signer email', async () => {
    await service.scheduleSignatureReminder('t1', 'c1', 'signer@example.com');

    expect(reminders.save).toHaveBeenCalledWith(
      expect.objectContaining({
        reminderType: 'pending_signature',
        recipientEmail: 'signer@example.com',
      }),
    );
  });

  describe('immediate notifications', () => {
    it('dispatches a signature_expired notice right away as a tenant-wide in-app notice', async () => {
      await service.notifySignatureExpired('t1', 'c1');

      expect(notificationsService.send).not.toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'reminder.sent',
        expect.objectContaining({
          tenantId: 't1',
          contractId: 'c1',
          reminderType: 'signature_expired',
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'notification.dispatched',
        expect.objectContaining({ tenantId: 't1', recipient: 't1', channel: 'in-app' }),
      );
    });

    it('dispatches a revision_requested notice right away as a tenant-wide in-app notice', async () => {
      await service.notifyRevisionRequested('t1', 'c1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'reminder.sent',
        expect.objectContaining({ reminderType: 'revision_requested' }),
      );
    });
  });

  describe('dispatchDueReminders', () => {
    it('sends an email for a due reminder with a recipient email and marks it sent', async () => {
      const due = {
        id: 'r1',
        tenantId: 't1',
        contractId: 'c1',
        reminderType: 'pending_signature',
        recipientUserId: null,
        recipientEmail: 'signer@example.com',
        scheduledFor: new Date(Date.now() - 1000),
        status: 'pending',
        sentAt: null,
      } as Reminder;
      reminders.find.mockResolvedValue([due]);

      await service.dispatchDueReminders();

      expect(notificationsService.send).toHaveBeenCalledWith(
        't1',
        'signer@example.com',
        'reminder',
        {
          contractId: 'c1',
          reminderType: 'pending_signature',
        },
      );
      expect(reminders.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'sent', sentAt: expect.any(Date) }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'notification.dispatched',
        expect.objectContaining({ recipient: 'signer@example.com', channel: 'email' }),
      );
    });

    it('dispatches a due reminder without a recipient email as in-app only, without calling NotificationsService', async () => {
      const due = {
        id: 'r2',
        tenantId: 't1',
        contractId: 'c1',
        reminderType: 'pending_approval',
        recipientUserId: 'approver-1',
        recipientEmail: null,
        scheduledFor: new Date(Date.now() - 1000),
        status: 'pending',
        sentAt: null,
      } as Reminder;
      reminders.find.mockResolvedValue([due]);

      await service.dispatchDueReminders();

      expect(notificationsService.send).not.toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'notification.dispatched',
        expect.objectContaining({ recipient: 'approver-1', channel: 'in-app' }),
      );
    });
  });

  describe('listReminders', () => {
    it('lists reminders scoped to the tenant and contract', async () => {
      await service.listReminders('t1', 'c1');

      expect(reminders.find).toHaveBeenCalledWith({
        where: { tenantId: 't1', contractId: 'c1' },
        order: { createdAt: 'DESC' },
      });
    });
  });
});
