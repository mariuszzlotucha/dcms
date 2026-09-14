import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileStorageService } from '@platform/file-storage/file-storage.service';
import { UsageMeteringService } from '@platform/usage-metering/usage-metering.service';
import { EVENTS, EventPayloadMap } from '@';
import { SignatureEnvelope } from './entities/signature-envelope.entity';
import { DocuSignEsignatureProvider } from './providers/docusign-esignature.provider';

// The metric key usage-metering is pre-configured with in app.module.ts
// (limitsByPlan['esignature.request']).
const USAGE_METRIC = 'esignature.request';

const TERMINAL_STATUSES = new Set(['completed', 'declined', 'expired']);

@Injectable()
export class EsignatureService {
  constructor(
    @InjectRepository(SignatureEnvelope)
    private readonly envelopes: Repository<SignatureEnvelope>,
    private readonly fileStorageService: FileStorageService,
    private readonly usageMeteringService: UsageMeteringService,
    private readonly docusignProvider: DocuSignEsignatureProvider,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async requestSignature(
    tenantId: string,
    contractId: string,
    fileId: string,
    signerEmail: string,
    signerName: string,
  ): Promise<SignatureEnvelope> {
    const usage = await this.usageMeteringService.checkAndIncrement(tenantId, USAGE_METRIC);

    if (!usage.allowed) {
      throw new ForbiddenException('Plan limit for signature requests reached');
    }

    const fileBuffer = await this.downloadFile(tenantId, fileId);

    const { envelopeId } = await this.docusignProvider.sendEnvelope({
      signerEmail,
      signerName,
      documentName: `contract-${contractId}.pdf`,
      fileBuffer,
    });

    const envelope = await this.envelopes.save(
      this.envelopes.create({
        tenantId,
        contractId,
        fileId,
        provider: this.docusignProvider.name,
        envelopeId,
        signerEmail,
        signerName,
        status: 'sent',
      }),
    );

    // DocuSign's "create with status: sent" call both requests and delivers
    // the envelope in one round trip for v0 — both events fire together
    // rather than one persisted 'requested' row later being promoted by a
    // webhook, since there is no meaningful gap between the two here.
    this.eventEmitter.emit(
      EVENTS.ESIGNATURE_REQUESTED,
      {
        contractId,
        tenantId,
        envelopeId,
        provider: envelope.provider,
      } satisfies EventPayloadMap[typeof EVENTS.ESIGNATURE_REQUESTED],
    );
    this.eventEmitter.emit(
      EVENTS.ESIGNATURE_SENT,
      {
        contractId,
        tenantId,
        envelopeId,
        recipientEmail: signerEmail,
      } satisfies EventPayloadMap[typeof EVENTS.ESIGNATURE_SENT],
    );

    return envelope;
  }

  async listEnvelopes(tenantId: string, contractId: string): Promise<SignatureEnvelope[]> {
    return this.envelopes.find({ where: { tenantId, contractId }, order: { requestedAt: 'DESC' } });
  }

  // The following are invoked from EsignatureListener off DocuSign Connect
  // webhook callbacks (routed through platform/webhooks-inbound), which
  // carry only the provider's envelopeId — never our tenantId — so lookups
  // here are deliberately not tenant-scoped. Each is idempotent against
  // webhook redelivery: once an envelope reaches a terminal status, further
  // callbacks for it are silently ignored rather than re-emitting events.

  async markCompleted(envelopeId: string, completedAt: Date): Promise<void> {
    const envelope = await this.findByEnvelopeId(envelopeId);

    if (!envelope || TERMINAL_STATUSES.has(envelope.status)) {
      return;
    }

    envelope.status = 'completed';
    const saved = await this.envelopes.save(envelope);

    this.eventEmitter.emit(
      EVENTS.ESIGNATURE_COMPLETED,
      {
        contractId: saved.contractId,
        tenantId: saved.tenantId,
        envelopeId,
        completedAt,
      } satisfies EventPayloadMap[typeof EVENTS.ESIGNATURE_COMPLETED],
    );
  }

  async markDeclined(envelopeId: string, reason: string): Promise<void> {
    const envelope = await this.findByEnvelopeId(envelopeId);

    if (!envelope || TERMINAL_STATUSES.has(envelope.status)) {
      return;
    }

    envelope.status = 'declined';
    envelope.declineReason = reason;
    const saved = await this.envelopes.save(envelope);

    this.eventEmitter.emit(
      EVENTS.ESIGNATURE_DECLINED,
      {
        contractId: saved.contractId,
        tenantId: saved.tenantId,
        envelopeId,
        reason,
      } satisfies EventPayloadMap[typeof EVENTS.ESIGNATURE_DECLINED],
    );
  }

  async markExpired(envelopeId: string): Promise<void> {
    const envelope = await this.findByEnvelopeId(envelopeId);

    if (!envelope || TERMINAL_STATUSES.has(envelope.status)) {
      return;
    }

    envelope.status = 'expired';
    const saved = await this.envelopes.save(envelope);

    this.eventEmitter.emit(
      EVENTS.ESIGNATURE_EXPIRED,
      {
        contractId: saved.contractId,
        tenantId: saved.tenantId,
        envelopeId,
      } satisfies EventPayloadMap[typeof EVENTS.ESIGNATURE_EXPIRED],
    );
  }

  private async findByEnvelopeId(envelopeId: string): Promise<SignatureEnvelope | null> {
    return this.envelopes.findOne({ where: { envelopeId } });
  }

  private async downloadFile(tenantId: string, fileId: string): Promise<Buffer> {
    const url = await this.fileStorageService.getDownloadUrl(tenantId, fileId);
    const response = await fetch(url);

    if (!response.ok) {
      throw new BadRequestException('Unable to download the selected file for signing');
    }

    return Buffer.from(await response.arrayBuffer());
  }
}
