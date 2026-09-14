import { z } from 'zod';

// Single source of truth for the `esignature` domain module's
// request/response shapes. See docs/dcms-domain-architecture.md 1.4 and
// .claude/rules/domain-backend.md. MVP v0 supports DocuSign only — Adobe
// Sign is v1 (the provider enum already anticipates it).
export const esignatureProviderSchema = z.enum(['docusign', 'adobe_sign']);
export type EsignatureProviderName = z.infer<typeof esignatureProviderSchema>;

export const signatureEnvelopeStatusSchema = z.enum([
  'requested',
  'sent',
  'completed',
  'declined',
  'expired',
]);
export type SignatureEnvelopeStatus = z.infer<typeof signatureEnvelopeStatusSchema>;

export const requestSignatureSchema = z.object({
  // Opaque reference to a contracts.ContractVersion's fileId (a platform
  // file-storage FileRecord#id) — the client picks which uploaded version
  // to send, since esignature has no way to query contracts' own tables
  // (see the DCMS CLAUDE.md invariant on domain → domain imports).
  fileId: z.string().uuid(),
  signerEmail: z.string().email(),
  signerName: z.string().min(1).max(200),
});
export type RequestSignatureDto = z.infer<typeof requestSignatureSchema>;
