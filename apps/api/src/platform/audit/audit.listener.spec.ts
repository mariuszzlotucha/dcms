import { EventEmitter2 } from '@nestjs/event-emitter';
import { PiiRedactionService } from '@platform/pii-redaction/pii-redaction.service';
import { AuditListener } from './audit.listener';
import { AuditService } from './audit.module';
import { AuditModuleConfig } from './audit.config';

// handleEvent is private — reached either through the onAny subscription
// (tested separately below) or, for the branch-by-branch behavior tests,
// via a direct cast bypass rather than changing its visibility for testing.
type ListenerInternals = {
  handleEvent(event: string | string[], payload: unknown): Promise<void>;
};

describe('AuditListener', () => {
  let eventEmitter: { onAny: jest.Mock };
  let auditService: { record: jest.Mock };
  let piiRedactionService: { redactText: jest.Mock };
  let listener: AuditListener;

  const config: AuditModuleConfig = { excludedEvents: ['noisy.event'] };

  beforeEach(() => {
    eventEmitter = { onAny: jest.fn() };
    auditService = { record: jest.fn() };
    piiRedactionService = { redactText: jest.fn((text: string) => text) };

    listener = new AuditListener(
      eventEmitter as unknown as EventEmitter2,
      auditService as unknown as AuditService,
      piiRedactionService as unknown as PiiRedactionService,
      config,
    );
  });

  describe('onModuleInit', () => {
    it('subscribes via onAny and forwards events into handleEvent', () => {
      const handleEventSpy = jest.spyOn(listener as unknown as ListenerInternals, 'handleEvent').mockResolvedValue();

      listener.onModuleInit();

      expect(eventEmitter.onAny).toHaveBeenCalledWith(expect.any(Function));
      const callback = eventEmitter.onAny.mock.calls[0][0] as (event: string, ...values: unknown[]) => void;
      callback('contract.created', { tenantId: 't1' });

      expect(handleEventSpy).toHaveBeenCalledWith('contract.created', { tenantId: 't1' });
    });
  });

  describe('handleEvent', () => {
    const handleEvent = (event: string | string[], payload: unknown) =>
      (listener as unknown as ListenerInternals).handleEvent(event, payload);

    it('skips recording an excluded event entirely', async () => {
      await handleEvent('noisy.event', { tenantId: 't1' });

      expect(auditService.record).not.toHaveBeenCalled();
    });

    it('joins an array-form event name with a dot', async () => {
      await handleEvent(['contract', 'created'], {});

      expect(auditService.record).toHaveBeenCalledWith('contract.created', null, null, {});
    });

    it('extracts actorId from payload.actorId when present', async () => {
      await handleEvent('contract.created', { actorId: 'u1', tenantId: 't1' });

      expect(auditService.record).toHaveBeenCalledWith('contract.created', 'u1', 't1', expect.anything());
    });

    it('falls back to payload.userId when actorId is absent', async () => {
      await handleEvent('auth.user.registered', { userId: 'u2', tenantId: 't1' });

      expect(auditService.record).toHaveBeenCalledWith('auth.user.registered', 'u2', 't1', expect.anything());
    });

    it('records a null actorId and tenantId when the payload has neither', async () => {
      await handleEvent('scheduler.jobCompleted', { jobName: 'idempotency-cleanup' });

      expect(auditService.record).toHaveBeenCalledWith('scheduler.jobCompleted', null, null, expect.anything());
    });

    it('leaves a non-object payload as-is (no redaction round-trip) and records null actor/tenant', async () => {
      await handleEvent('some.event', 'a plain string payload');

      expect(auditService.record).toHaveBeenCalledWith('some.event', null, null, 'a plain string payload');
      expect(piiRedactionService.redactText).not.toHaveBeenCalled();
    });

    it('runs the payload through PiiRedactionService before storing it', async () => {
      piiRedactionService.redactText.mockImplementation((text: string) => text.replace('a@example.com', '[REDACTED]'));

      await handleEvent('contract.created', { tenantId: 't1', signerEmail: 'a@example.com' });

      expect(auditService.record).toHaveBeenCalledWith(
        'contract.created',
        null,
        't1',
        expect.objectContaining({ signerEmail: '[REDACTED]' }),
      );
    });
  });
});
