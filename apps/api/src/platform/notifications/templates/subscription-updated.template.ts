export interface SubscriptionUpdatedTemplateData {
  planName: string;
  status: string;
}

export function buildSubscriptionUpdatedTemplate(
  data: SubscriptionUpdatedTemplateData,
): { subject: string; body: string } {
  return {
    subject: 'Your DCMS subscription has been updated',
    body: `Your subscription is now on the ${data.planName} plan (status: ${data.status}).`,
  };
}
