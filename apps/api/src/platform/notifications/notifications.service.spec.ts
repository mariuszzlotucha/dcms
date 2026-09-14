import { EventEmitter2 } from '@nestjs/event-emitter';
import { SecretsService } from '@platform/secrets/secrets.service';
import { PLATFORM_EVENTS } from '../events';
import { NotificationsService } from './notifications.service';
import { NotificationsModuleConfig } from './notifications.config';

const mockSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}));

describe('NotificationsService', () => {
  let secretsService: { getProviderSecret: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let service: NotificationsService;

  const config: NotificationsModuleConfig = { fromAddress: 'DCMS <noreply@dcms.app>' };

  beforeEach(() => {
    mockSend.mockReset();
    secretsService = { getProviderSecret: jest.fn().mockReturnValue('resend-api-key') };
    eventEmitter = { emit: jest.fn() };

    service = new NotificationsService(config, secretsService as unknown as SecretsService, eventEmitter as unknown as EventEmitter2);
  });

  it('constructs the Resend client with the configured secret', () => {
    expect(secretsService.getProviderSecret).toHaveBeenCalledWith('resend');
  });

  it('renders the named template and sends it via the configured from address', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email-1' }, error: null });

    await service.send('t1', 'user@example.com', 'welcome', { recipientName: 'Jane' });

    expect(mockSend).toHaveBeenCalledWith({
      from: 'DCMS <noreply@dcms.app>',
      to: 'user@example.com',
      subject: 'Welcome to DCMS',
      text: expect.stringContaining('Jane'),
    });
  });

  it('emits NOTIFICATION_SENT on success', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email-1' }, error: null });

    await service.send('t1', 'user@example.com', 'welcome', { recipientName: 'Jane' });

    expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.NOTIFICATION_SENT, {
      tenantId: 't1',
      recipient: 'user@example.com',
      template: 'welcome',
      channel: 'email',
    });
  });

  it('emits NOTIFICATION_FAILED (and does not throw) when Resend reports an error result', async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: 'invalid recipient' } });

    await expect(
      service.send('t1', 'bad@example.com', 'welcome', { recipientName: 'Jane' }),
    ).resolves.toBeUndefined();

    expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.NOTIFICATION_FAILED, {
      tenantId: 't1',
      reason: 'invalid recipient',
    });
    expect(eventEmitter.emit).not.toHaveBeenCalledWith(PLATFORM_EVENTS.NOTIFICATION_SENT, expect.anything());
  });

  it('emits NOTIFICATION_FAILED (and does not throw) when the Resend call itself rejects', async () => {
    mockSend.mockRejectedValue(new Error('network timeout'));

    await expect(
      service.send('t1', 'user@example.com', 'welcome', { recipientName: 'Jane' }),
    ).resolves.toBeUndefined();

    expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.NOTIFICATION_FAILED, {
      tenantId: 't1',
      reason: 'network timeout',
    });
  });

  it('renders the password-reset template with the reset link', async () => {
    mockSend.mockResolvedValue({ data: {}, error: null });

    await service.send('t1', 'user@example.com', 'password-reset', { resetLink: 'https://dcms.app/reset/abc' });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Reset your DCMS password', text: expect.stringContaining('https://dcms.app/reset/abc') }),
    );
  });
});
