import Stripe from 'stripe';
import { WebhookProvider, WebhookVerificationResult } from '../webhooks-inbound.module';

export const stripeProvider: WebhookProvider = {
  name: 'stripe',
  secretName: 'stripeWebhookSecret',
  verify(rawBody, headers, secret): WebhookVerificationResult {
    const signature = headers['stripe-signature'];

    if (!signature || Array.isArray(signature)) {
      return { verified: false, eventType: 'unknown', payload: null };
    }

    try {
      const event = Stripe.webhooks.constructEvent(rawBody, signature, secret);
      return { verified: true, eventType: event.type, payload: event.data.object };
    } catch {
      return { verified: false, eventType: 'unknown', payload: null };
    }
  },
};
