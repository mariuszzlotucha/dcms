import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EsignatureService } from './esignature.service';
import { SignatureEnvelope } from './entities/signature-envelope.entity';

describe('EsignatureService', () => {
  let envelopes: { findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock };
  let fileStorageService: { getDownloadUrl: jest.Mock };
  let usageMeteringService: { checkAndIncrement: jest.Mock };
  let docusignProvider: { name: 'docusign'; sendEnvelope: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let service: EsignatureService;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    envelopes = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => data as SignatureEnvelope),
      save: jest.fn(async (data) => ({ id: 'env-1', ...data }) as SignatureEnvelope),
    };
    fileStorageService = { getDownloadUrl: jest.fn().mockResolvedValue('https://files.example/signed-url') };
    usageMeteringService = { checkAndIncrement: jest.fn().mockResolvedValue({ allowed: true, current: 1, limit: 5 }) };
    docusignProvider = { name: 'docusign', sendEnvelope: jest.fn().mockResolvedValue({ envelopeId: 'ds-envelope-1' }) };
    eventEmitter = { emit: jest.fn() };

    originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('pdf-bytes').buffer,
    }) as unknown as typeof fetch;

    service = new EsignatureService(
      envelopes as never,
      fileStorageService as never,
      usageMeteringService as never,
      docusignProvider as never,
      eventEmitter as never,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('requestSignature', () => {
    it('downloads the file, sends the envelope, persists it, and emits both requested and sent', async () => {
      const result = await service.requestSignature('t1', 'c1', 'file-1', 'signer@example.com', 'Jane Signer');

      expect(usageMeteringService.checkAndIncrement).toHaveBeenCalledWith('t1', 'esignature.request');
      expect(fileStorageService.getDownloadUrl).toHaveBeenCalledWith('t1', 'file-1');
      expect(docusignProvider.sendEnvelope).toHaveBeenCalledWith(
        expect.objectContaining({ signerEmail: 'signer@example.com', signerName: 'Jane Signer' }),
      );
      expect(result.id).toBe('env-1');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'esignature.requested',
        expect.objectContaining({ contractId: 'c1', tenantId: 't1', envelopeId: 'ds-envelope-1', provider: 'docusign' }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'esignature.sent',
        expect.objectContaining({
          contractId: 'c1',
          tenantId: 't1',
          envelopeId: 'ds-envelope-1',
          recipientEmail: 'signer@example.com',
        }),
      );
    });

    it('rejects once the plan limit for signature requests is exceeded', async () => {
      usageMeteringService.checkAndIncrement.mockResolvedValue({ allowed: false, current: 5, limit: 5 });

      await expect(
        service.requestSignature('t1', 'c1', 'file-1', 'signer@example.com', 'Jane Signer'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(docusignProvider.sendEnvelope).not.toHaveBeenCalled();
    });

    it('fails cleanly when the selected file cannot be downloaded', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

      await expect(
        service.requestSignature('t1', 'c1', 'file-1', 'signer@example.com', 'Jane Signer'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(docusignProvider.sendEnvelope).not.toHaveBeenCalled();
    });
  });

  describe('markCompleted', () => {
    it('marks a sent envelope completed and emits esignature.completed', async () => {
      envelopes.findOne.mockResolvedValue({ id: 'env-1', tenantId: 't1', contractId: 'c1', status: 'sent' });
      const completedAt = new Date('2026-01-01T00:00:00Z');

      await service.markCompleted('ds-envelope-1', completedAt);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'esignature.completed',
        expect.objectContaining({ contractId: 'c1', tenantId: 't1', envelopeId: 'ds-envelope-1', completedAt }),
      );
    });

    it('ignores a redelivered webhook for an already-terminal envelope', async () => {
      envelopes.findOne.mockResolvedValue({ id: 'env-1', tenantId: 't1', contractId: 'c1', status: 'completed' });

      await service.markCompleted('ds-envelope-1', new Date());

      expect(envelopes.save).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('ignores a webhook for an unknown envelope id', async () => {
      envelopes.findOne.mockResolvedValue(null);

      await service.markCompleted('unknown-envelope', new Date());

      expect(envelopes.save).not.toHaveBeenCalled();
    });
  });

  describe('markDeclined', () => {
    it('marks a sent envelope declined with a reason and emits esignature.declined', async () => {
      envelopes.findOne.mockResolvedValue({ id: 'env-1', tenantId: 't1', contractId: 'c1', status: 'sent' });

      await service.markDeclined('ds-envelope-1', 'missing signature block');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'esignature.declined',
        expect.objectContaining({
          contractId: 'c1',
          tenantId: 't1',
          envelopeId: 'ds-envelope-1',
          reason: 'missing signature block',
        }),
      );
    });
  });

  describe('markExpired', () => {
    it('marks a sent envelope expired and emits esignature.expired', async () => {
      envelopes.findOne.mockResolvedValue({ id: 'env-1', tenantId: 't1', contractId: 'c1', status: 'sent' });

      await service.markExpired('ds-envelope-1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'esignature.expired',
        expect.objectContaining({ contractId: 'c1', tenantId: 't1', envelopeId: 'ds-envelope-1' }),
      );
    });
  });
});
