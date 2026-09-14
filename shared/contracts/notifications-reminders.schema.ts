import { z } from 'zod';

// Single source of truth for the `notifications-reminders` domain module's
// response shapes. See docs/dcms-domain-architecture.md 1.8 and
// .claude/rules/domain-backend.md. No input DTOs: every reminder is created
// by the module reacting to domain events, never by a user-facing POST.
export const reminderTypeSchema = z.enum([
  'pending_review',
  'pending_approval',
  'pending_signature',
  'signature_expired',
  'revision_requested',
]);
export type ReminderType = z.infer<typeof reminderTypeSchema>;

export const reminderStatusSchema = z.enum(['pending', 'sent', 'cancelled']);
export type ReminderStatus = z.infer<typeof reminderStatusSchema>;
