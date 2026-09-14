import { NotificationsRemindersListener } from './notifications-reminders.listener';
import { NotificationsRemindersService } from './notifications-reminders.service';

describe('NotificationsRemindersListener', () => {
  let service: {
    scheduleContractStageReminder: jest.Mock;
    scheduleApprovalReminder: jest.Mock;
    scheduleSignatureReminder: jest.Mock;
    notifySignatureExpired: jest.Mock;
    notifyRevisionRequested: jest.Mock;
  };
  let listener: NotificationsRemindersListener;

  beforeEach(() => {
    service = {
      scheduleContractStageReminder: jest.fn(),
      scheduleApprovalReminder: jest.fn(),
      scheduleSignatureReminder: jest.fn(),
      notifySignatureExpired: jest.fn(),
      notifyRevisionRequested: jest.fn(),
    };
    listener = new NotificationsRemindersListener(
      service as unknown as NotificationsRemindersService,
    );
  });

  it('reacts to contract.statusChanged', async () => {
    await listener.handleContractStatusChanged({
      tenantId: 't1',
      contractId: 'c1',
      previousStatus: 'in_review',
      newStatus: 'negotiation',
    });

    expect(service.scheduleContractStageReminder).toHaveBeenCalledWith('t1', 'c1', 'negotiation');
  });

  it('reacts to approval.requested', async () => {
    await listener.handleApprovalRequested({
      tenantId: 't1',
      contractId: 'c1',
      approverId: 'approver-1',
    });

    expect(service.scheduleApprovalReminder).toHaveBeenCalledWith('t1', 'c1', 'approver-1');
  });

  it('reacts to esignature.sent', async () => {
    await listener.handleEsignatureSent({
      tenantId: 't1',
      contractId: 'c1',
      envelopeId: 'env-1',
      recipientEmail: 'signer@example.com',
    });

    expect(service.scheduleSignatureReminder).toHaveBeenCalledWith(
      't1',
      'c1',
      'signer@example.com',
    );
  });

  it('reacts to esignature.expired', async () => {
    await listener.handleEsignatureExpired({
      tenantId: 't1',
      contractId: 'c1',
      envelopeId: 'env-1',
    });

    expect(service.notifySignatureExpired).toHaveBeenCalledWith('t1', 'c1');
  });

  it('reacts to negotiation.revisionRequested', async () => {
    await listener.handleNegotiationRevisionRequested({
      tenantId: 't1',
      contractId: 'c1',
      requestedBy: 'u1',
      comment: 'please adjust clause 3',
    });

    expect(service.notifyRevisionRequested).toHaveBeenCalledWith('t1', 'c1');
  });
});
