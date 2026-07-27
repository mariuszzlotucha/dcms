export interface WelcomeTemplateData {
  recipientName: string;
}

export function buildWelcomeTemplate(data: WelcomeTemplateData): { subject: string; body: string } {
  return {
    subject: 'Welcome to DCMS',
    body: `Hi ${data.recipientName},\n\nWelcome to DCMS — your account is ready to go.`,
  };
}
