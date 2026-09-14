import { z } from 'zod';

// Single source of truth for the `contracts` domain module's request/response
// shapes — consumed by apps/api (validation) and apps/web (typed client).
// See docs/dcms-domain-architecture.md 1.1 and .claude/rules/domain-backend.md.

// Mirrors the lifecycle in dcms-domain-architecture.md 1.1: draft → in review
// → negotiation → approved → signed → active → expired/terminated, plus the
// separate `archived` state (its own event, not part of the linear flow).
export const contractStatusSchema = z.enum([
  'draft',
  'in_review',
  'negotiation',
  'approved',
  'signed',
  'active',
  'expired',
  'terminated',
  'archived',
]);
export type ContractStatus = z.infer<typeof contractStatusSchema>;

export const createContractSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  // Opaque reference to a `templates` module Template id — not a foreign
  // key: domain modules don't import each other's entities (see the DCMS
  // CLAUDE.md invariant on domain → domain imports).
  templateId: z.string().uuid().optional(),
});
export type CreateContractDto = z.infer<typeof createContractSchema>;

// templateId is deliberately not editable after creation.
export const updateContractSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
});
export type UpdateContractDto = z.infer<typeof updateContractSchema>;

export const changeContractStatusSchema = z.object({
  status: contractStatusSchema,
});
export type ChangeContractStatusDto = z.infer<typeof changeContractStatusSchema>;
