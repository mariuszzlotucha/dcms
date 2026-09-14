import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Stripe from 'stripe';
import { NotificationsService } from '@platform/notifications/notifications.service';
import { PLATFORM_EVENTS } from '../events';
import { BillingService } from './billing.service';
import { BillingModuleConfig } from './billing.config';
import { Subscription } from './entities/subscription.entity';

describe('BillingService', () => {
  let subscriptions: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let stripe: {
    customers: { create: jest.Mock; retrieve: jest.Mock };
    checkout: { sessions: { create: jest.Mock } };
    subscriptions: { retrieve: jest.Mock; update: jest.Mock };
  };
  let notificationsService: { send: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let service: BillingService;

  const config: BillingModuleConfig = {
    plans: {
      starter: { stripePriceId: 'price_starter', name: 'Starter' },
      pro: { stripePriceId: 'price_pro', name: 'Pro' },
    },
    successUrl: 'https://app.dcms.example/billing/success',
    cancelUrl: 'https://app.dcms.example/billing/cancel',
  };

  beforeEach(() => {
    subscriptions = {
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => ({ id: 's1', updatedAt: new Date(), ...data }) as Subscription),
    };
    stripe = {
      customers: {
        create: jest.fn().mockResolvedValue({ id: 'cus_new' }),
        retrieve: jest.fn().mockResolvedValue({ email: 'billing@example.com', deleted: false }),
      },
      checkout: {
        sessions: {
          create: jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/session' }),
        },
      },
      subscriptions: {
        retrieve: jest.fn(),
        update: jest.fn(),
      },
    };
    notificationsService = { send: jest.fn() };
    eventEmitter = { emit: jest.fn() };

    service = new BillingService(
      subscriptions as never,
      config,
      stripe as unknown as Stripe,
      notificationsService as unknown as NotificationsService,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  describe('createCheckoutSession', () => {
    it('throws NotFoundException for an unknown plan', async () => {
      await expect(service.createCheckoutSession('t1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates a new Stripe customer when the tenant has none yet', async () => {
      subscriptions.findOne.mockResolvedValue(null);

      await service.createCheckoutSession('t1', 'starter');

      expect(stripe.customers.create).toHaveBeenCalledWith({ metadata: { tenantId: 't1' } });
    });

    it('reuses the existing Stripe customer id when the tenant already has a subscription', async () => {
      subscriptions.findOne.mockResolvedValue({ stripeCustomerId: 'cus_existing' } as Subscription);

      await service.createCheckoutSession('t1', 'starter');

      expect(stripe.customers.create).not.toHaveBeenCalled();
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer: 'cus_existing' }),
      );
    });

    it('returns the checkout session URL', async () => {
      subscriptions.findOne.mockResolvedValue(null);

      await expect(service.createCheckoutSession('t1', 'starter')).resolves.toBe(
        'https://checkout.stripe.com/session',
      );
    });

    it('throws when Stripe returns no checkout URL', async () => {
      subscriptions.findOne.mockResolvedValue(null);
      stripe.checkout.sessions.create.mockResolvedValue({ url: null });

      await expect(service.createCheckoutSession('t1', 'starter')).rejects.toThrow(
        'Stripe did not return a checkout URL',
      );
    });
  });

  describe('getSubscription', () => {
    it('returns the most recently updated subscription for the tenant', async () => {
      subscriptions.findOne.mockResolvedValue({ tenantId: 't1' } as Subscription);

      await service.getSubscription('t1');

      expect(subscriptions.findOne).toHaveBeenCalledWith({
        where: { tenantId: 't1' },
        order: { updatedAt: 'DESC' },
      });
    });
  });

  describe('changePlan', () => {
    it('throws NotFoundException for an unknown plan', async () => {
      await expect(service.changePlan('t1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the tenant has no subscription', async () => {
      subscriptions.findOne.mockResolvedValue(null);

      await expect(service.changePlan('t1', 'pro')).rejects.toThrow(
        'No active subscription for tenant',
      );
    });

    it('throws when the Stripe subscription has no line items', async () => {
      subscriptions.findOne.mockResolvedValue({ stripeSubscriptionId: 'sub_1' } as Subscription);
      stripe.subscriptions.retrieve.mockResolvedValue({ items: { data: [] } });

      await expect(service.changePlan('t1', 'pro')).rejects.toThrow(
        'Stripe subscription has no line items',
      );
    });

    it('updates the Stripe subscription item to the new plan price and saves the local record', async () => {
      subscriptions.findOne.mockResolvedValue({
        tenantId: 't1',
        stripeSubscriptionId: 'sub_1',
        stripeCustomerId: 'cus_1',
        plan: 'starter',
        status: 'active',
      } as Subscription);
      stripe.subscriptions.retrieve.mockResolvedValue({ items: { data: [{ id: 'si_1' }] } });

      const result = await service.changePlan('t1', 'pro');

      expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_1', {
        items: [{ id: 'si_1', price: 'price_pro' }],
      });
      expect(result.plan).toBe('pro');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        PLATFORM_EVENTS.BILLING_SUBSCRIPTION_UPDATED,
        expect.objectContaining({ tenantId: 't1', plan: 'pro' }),
      );
    });
  });

  describe('upsertFromStripeSubscription', () => {
    const buildStripeSubscription = (
      overrides: Partial<Stripe.Subscription> = {},
    ): Stripe.Subscription =>
      ({
        id: 'sub_1',
        customer: 'cus_1',
        status: 'active',
        metadata: { tenantId: 't1' },
        items: { data: [{ price: { id: 'price_pro' } }] },
        ...overrides,
      }) as unknown as Stripe.Subscription;

    it('throws when a brand-new Stripe subscription has no tenantId metadata', async () => {
      subscriptions.findOne.mockResolvedValue(null);
      const stripeSubscription = buildStripeSubscription({ metadata: {} });

      await expect(service.upsertFromStripeSubscription(stripeSubscription, false)).rejects.toThrow(
        'Stripe subscription sub_1 has no tenantId metadata',
      );
    });

    it('creates a new local record for a subscription not seen before', async () => {
      subscriptions.findOne.mockResolvedValue(null);
      const stripeSubscription = buildStripeSubscription();

      await service.upsertFromStripeSubscription(stripeSubscription, false);

      expect(subscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          stripeSubscriptionId: 'sub_1',
          stripeCustomerId: 'cus_1',
        }),
      );
    });

    it('resolves the plan key from the Stripe price id', async () => {
      subscriptions.findOne.mockResolvedValue(null);
      const stripeSubscription = buildStripeSubscription();

      const result = await service.upsertFromStripeSubscription(stripeSubscription, false);

      expect(result.plan).toBe('pro');
      expect(result.status).toBe('active');
    });

    it('keeps the previous plan when the Stripe price id does not match any configured plan', async () => {
      subscriptions.findOne.mockResolvedValue({
        tenantId: 't1',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        plan: 'starter',
        status: 'active',
      } as Subscription);
      const stripeSubscription = buildStripeSubscription({
        items: { data: [{ price: { id: 'price_unknown' } }] },
      } as never);

      const result = await service.upsertFromStripeSubscription(stripeSubscription, false);

      expect(result.plan).toBe('starter');
    });

    it('marks the status canceled when the deletion flag is set, regardless of the Stripe status field', async () => {
      subscriptions.findOne.mockResolvedValue(null);
      const stripeSubscription = buildStripeSubscription({ status: 'active' });

      const result = await service.upsertFromStripeSubscription(stripeSubscription, true);

      expect(result.status).toBe('canceled');
    });

    it('handles a customer object (not just a customer id string)', async () => {
      subscriptions.findOne.mockResolvedValue(null);
      const stripeSubscription = buildStripeSubscription({
        customer: { id: 'cus_object' } as Stripe.Customer,
      });

      const result = await service.upsertFromStripeSubscription(stripeSubscription, false);

      expect(result.stripeCustomerId).toBe('cus_object');
    });

    it('sends a subscription-updated notification to the customer email', async () => {
      subscriptions.findOne.mockResolvedValue(null);
      const stripeSubscription = buildStripeSubscription();

      await service.upsertFromStripeSubscription(stripeSubscription, false);

      expect(notificationsService.send).toHaveBeenCalledWith(
        't1',
        'billing@example.com',
        'subscription-updated',
        {
          planName: 'Pro',
          status: 'active',
        },
      );
    });

    it('skips the notification when the Stripe customer has been deleted', async () => {
      subscriptions.findOne.mockResolvedValue(null);
      stripe.customers.retrieve.mockResolvedValue({ deleted: true });
      const stripeSubscription = buildStripeSubscription();

      await service.upsertFromStripeSubscription(stripeSubscription, false);

      expect(notificationsService.send).not.toHaveBeenCalled();
    });

    it('skips the notification when the Stripe customer has no email', async () => {
      subscriptions.findOne.mockResolvedValue(null);
      stripe.customers.retrieve.mockResolvedValue({ deleted: false, email: null });
      const stripeSubscription = buildStripeSubscription();

      await service.upsertFromStripeSubscription(stripeSubscription, false);

      expect(notificationsService.send).not.toHaveBeenCalled();
    });
  });
});
