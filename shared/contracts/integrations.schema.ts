import { z } from 'zod';

// Single source of truth for the `integrations` domain module's
// request/response shapes. See docs/dcms-domain-architecture.md 1.9 and
// .claude/rules/domain-backend.md.
export const integrationTypeSchema = z.enum(['salesforce', 'hubspot', 'google-drive', 'ms365']);
export type IntegrationType = z.infer<typeof integrationTypeSchema>;

export const integrationSyncStatusSchema = z.enum(['idle', 'syncing', 'completed', 'failed']);
export type IntegrationSyncStatus = z.infer<typeof integrationSyncStatusSchema>;

export const connectIntegrationSchema = z.object({
  // No OAuth consent flow for any of the four providers is built yet (v0) —
  // connecting hands DCMS a URL to push sync payloads to (e.g. a Zapier/
  // Make.com relay or a tenant-owned endpoint), not real provider credentials.
  syncUrl: z.string().url(),
});
export type ConnectIntegrationDto = z.infer<typeof connectIntegrationSchema>;
