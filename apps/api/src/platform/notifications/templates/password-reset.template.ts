export interface PasswordResetTemplateData {
  resetLink: string;
}

export function buildPasswordResetTemplate(data: PasswordResetTemplateData): { subject: string; body: string } {
  return {
    subject: 'Reset your DCMS password',
    body: `We received a request to reset your password.\n\nReset it here: ${data.resetLink}\n\nIf you didn't request this, you can ignore this email.`,
  };
}
