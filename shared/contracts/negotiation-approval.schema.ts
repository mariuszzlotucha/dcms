import { z } from 'zod';

// Single source of truth for the `negotiation-approval` domain module's
// request/response shapes. See docs/dcms-domain-architecture.md 1.3 and
// .claude/rules/domain-backend.md.
//
// Deliberately a different vocabulary from platform rbac's tenant-level
// 'owner' | 'admin' | 'member': these are per-contract process roles, not
// tenant membership roles.
export const negotiationRoleSchema = z.enum(['owner', 'reviewer', 'approver']);
export type NegotiationRole = z.infer<typeof negotiationRoleSchema>;

export const assignNegotiationRoleSchema = z.object({
  userId: z.string().uuid(),
  role: negotiationRoleSchema,
});
export type AssignNegotiationRoleDto = z.infer<typeof assignNegotiationRoleSchema>;

export const approvalRequestStatusSchema = z.enum(['pending', 'granted', 'rejected']);
export type ApprovalRequestStatus = z.infer<typeof approvalRequestStatusSchema>;

export const rejectApprovalSchema = z.object({
  reason: z.string().min(1).max(2000),
});
export type RejectApprovalDto = z.infer<typeof rejectApprovalSchema>;

export const requestRevisionSchema = z.object({
  comment: z.string().min(1).max(5000),
});
export type RequestRevisionDto = z.infer<typeof requestRevisionSchema>;
