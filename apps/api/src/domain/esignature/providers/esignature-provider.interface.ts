import type { EsignatureProviderName } from '@contracts/esignature.schema';

export interface SendEnvelopeInput {
  signerEmail: string;
  signerName: string;
  documentName: string;
  fileBuffer: Buffer;
}

export interface SendEnvelopeResult {
  envelopeId: string;
}

// Kept intentionally thin (dcms-domain-architecture.md 1.4: "Does NOT store
// provider logic itself, it's a thin adapter") — a second implementation
// (Adobe Sign) is v1, not hypothetical, so the interface earns its keep now.
export interface EsignatureProvider {
  readonly name: EsignatureProviderName;
  sendEnvelope(input: SendEnvelopeInput): Promise<SendEnvelopeResult>;
}
