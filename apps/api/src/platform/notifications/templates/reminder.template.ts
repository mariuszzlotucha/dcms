export interface ReminderTemplateData {
  contractId: string;
  reminderType: string;
}

const REMINDER_COPY: Record<string, string> = {
  pending_signature: 'Your signature is still pending on this contract.',
};

export function buildReminderTemplate(data: ReminderTemplateData): { subject: string; body: string } {
  const line = REMINDER_COPY[data.reminderType] ?? 'This contract needs your attention.';

  return {
    subject: 'Reminder from DCMS',
    body: `${line}\n\nContract: ${data.contractId}`,
  };
}
