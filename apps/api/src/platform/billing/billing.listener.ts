import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import Stripe from 'stripe';
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../events';
import { BillingService } from './billing.service';

const RELEVANT_EVENT_TYPES = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

@Injectable()
export class BillingListener {
  constructor(private readonly billingService: BillingService) {}

  @OnEvent(PLATFORM_EVENTS.WEBHOOK_RECEIVED)
  async handleWebhookReceived(
    event: PlatformEventPayloadMap[typeof PLATFORM_EVENTS.WEBHOOK_RECEIVED],
  ): Promise<void> {
    if (!event.verified || event.provider !== 'stripe' || !RELEVANT_EVENT_TYPES.has(event.eventType)) {
      return;
    }

    const stripeSubscription = event.payload as Stripe.Subscription;

    await this.billingService.upsertFromStripeSubscription(
      stripeSubscription,
      event.eventType === 'customer.subscription.deleted',
    );
  }
}
