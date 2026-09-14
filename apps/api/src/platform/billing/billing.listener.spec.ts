import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../events';
import { BillingListener } from './billing.listener';
import { BillingService } from './billing.service';

type WebhookReceivedEvent = PlatformEventPayloadMap[typeof PLATFORM_EVENTS.WEBHOOK_RECEIVED];

describe('BillingListener', () => {
  let billingService: { upsertFromStripeSubscription: jest.Mock };
  let listener: BillingListener;

  const buildEvent = (overrides: Partial<WebhookReceivedEvent>): WebhookReceivedEvent =>
    ({
      provider: 'stripe',
      verified: true,
      eventType: 'customer.subscription.updated',
      payload: { id: 'sub_1' },
      ...overrides,
    }) as WebhookReceivedEvent;

  beforeEach(() => {
    billingService = { upsertFromStripeSubscription: jest.fn() };
    listener = new BillingListener(billingService as unknown as BillingService);
  });

  it('ignores an unverified webhook', async () => {
    await listener.handleWebhookReceived(buildEvent({ verified: false }));

    expect(billingService.upsertFromStripeSubscription).not.toHaveBeenCalled();
  });

  it('ignores a webhook from a provider other than stripe', async () => {
    await listener.handleWebhookReceived(buildEvent({ provider: 'docusign' }));

    expect(billingService.upsertFromStripeSubscription).not.toHaveBeenCalled();
  });

  it('ignores an unrelated stripe event type', async () => {
    await listener.handleWebhookReceived(buildEvent({ eventType: 'invoice.paid' }));

    expect(billingService.upsertFromStripeSubscription).not.toHaveBeenCalled();
  });

  it.each(['customer.subscription.created', 'customer.subscription.updated'])(
    'upserts with canceled: false for %s',
    async (eventType) => {
      const event = buildEvent({ eventType });

      await listener.handleWebhookReceived(event);

      expect(billingService.upsertFromStripeSubscription).toHaveBeenCalledWith(event.payload, false);
    },
  );

  it('upserts with canceled: true for customer.subscription.deleted', async () => {
    const event = buildEvent({ eventType: 'customer.subscription.deleted' });

    await listener.handleWebhookReceived(event);

    expect(billingService.upsertFromStripeSubscription).toHaveBeenCalledWith(event.payload, true);
  });
});
