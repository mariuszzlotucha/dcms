import { z } from 'zod';

// Single source of truth for the `access-control` domain module's
// request/response shapes. See docs/dcms-domain-architecture.md 1.5 and
// .claude/rules/domain-backend.md.
//
// Contract-level permissions — distinct from platform rbac's tenant-level
// 'owner' | 'admin' | 'member' and from negotiation-approval's process
// roles ('owner' | 'reviewer' | 'approver'): this is "who can see/edit/
// comment on this one contract."
export const accessPermissionSchema = z.enum(['view', 'edit', 'comment']);
export type AccessPermission = z.infer<typeof accessPermissionSchema>;

export const grantAccessSchema = z.object({
  userId: z.string().uuid(),
  permission: accessPermissionSchema,
});
export type GrantAccessDto = z.infer<typeof grantAccessSchema>;

export const inviteParticipantSchema = z.object({
  email: z.string().email(),
  permission: accessPermissionSchema,
});
export type InviteParticipantDto = z.infer<typeof inviteParticipantSchema>;

export const addCommentSchema = z.object({
  body: z.string().min(1).max(5000),
});
export type AddCommentDto = z.infer<typeof addCommentSchema>;
