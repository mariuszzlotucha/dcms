export interface BillingModuleConfig {
  plans: Record<string, { stripePriceId: string; name: string }>;
  successUrl: string;
  cancelUrl: string;
}

export const BILLING_MODULE_CONFIG = 'BILLING_MODULE_CONFIG';
export const STRIPE_CLIENT = 'STRIPE_CLIENT';
