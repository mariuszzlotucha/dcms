import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { Repository } from 'typeorm';
import { NotificationsService } from '@platform/notifications/notifications.service';
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../events';
import { Subscription } from './entities/subscription.entity';
import { BILLING_MODULE_CONFIG, BillingModuleConfig } from './billing.config';
import { STRIPE_CLIENT } from './billing.module';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptions: Repository<Subscription>,
    @Inject(BILLING_MODULE_CONFIG)
    private readonly config: BillingModuleConfig,
    @Inject(STRIPE_CLIENT)
    private readonly stripe: Stripe,
    private readonly notificationsService: NotificationsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createCheckoutSession(tenantId: string, planKey: string): Promise<string> {
    const plan = this.config.plans[planKey];
    if (!plan) {
      throw new NotFoundException(`Unknown plan: ${planKey}`);
    }

    const existing = await this.subscriptions.findOne({ where: { tenantId }, order: { updatedAt: 'DESC' } });
    const stripeCustomerId =
      existing?.stripeCustomerId ?? (await this.stripe.customers.create({ metadata: { tenantId } })).id;

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      subscription_data: { metadata: { tenantId } },
      success_url: this.config.successUrl,
      cancel_url: this.config.cancelUrl,
    });

    if (!session.url) {
      throw new Error('Stripe did not return a checkout URL');
    }

    return session.url;
  }

  async getSubscription(tenantId: string): Promise<Subscription | null> {
    return this.subscriptions.findOne({ where: { tenantId }, order: { updatedAt: 'DESC' } });
  }

  async changePlan(tenantId: string, planKey: string): Promise<Subscription> {
    const plan = this.config.plans[planKey];
    if (!plan) {
      throw new NotFoundException(`Unknown plan: ${planKey}`);
    }

    const subscription = await this.subscriptions.findOne({ where: { tenantId }, order: { updatedAt: 'DESC' } });
    if (!subscription) {
      throw new NotFoundException('No active subscription for tenant');
    }

    const stripeSubscription = await this.stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    const itemId = stripeSubscription.items.data[0]?.id;
    if (!itemId) {
      throw new Error('Stripe subscription has no line items');
    }

    await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      items: [{ id: itemId, price: plan.stripePriceId }],
    });

    subscription.plan = planKey;
    return this.applyExternalUpdate(subscription);
  }

  async upsertFromStripeSubscription(stripeSubscription: Stripe.Subscription, canceled: boolean): Promise<Subscription> {
    const stripeCustomerId =
      typeof stripeSubscription.customer === 'string' ? stripeSubscription.customer : stripeSubscription.customer.id;

    const record =
      (await this.subscriptions.findOne({ where: { stripeSubscriptionId: stripeSubscription.id } })) ??
      this.subscriptions.create({
        tenantId: stripeSubscription.metadata?.tenantId ?? '',
        stripeCustomerId,
        stripeSubscriptionId: stripeSubscription.id,
        plan: '',
        status: '',
      });

    if (!record.tenantId) {
      throw new Error(`Stripe subscription ${stripeSubscription.id} has no tenantId metadata`);
    }

    record.stripeCustomerId = stripeCustomerId;
    record.plan = this.resolvePlanKey(stripeSubscription.items.data[0]?.price.id) ?? record.plan;
    record.status = canceled ? 'canceled' : stripeSubscription.status;

    return this.applyExternalUpdate(record);
  }

  private async applyExternalUpdate(record: Subscription): Promise<Subscription> {
    const saved = await this.subscriptions.save(record);

    this.eventEmitter.emit(
      PLATFORM_EVENTS.BILLING_SUBSCRIPTION_UPDATED,
      { tenantId: saved.tenantId, plan: saved.plan, status: saved.status } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.BILLING_SUBSCRIPTION_UPDATED],
    );

    await this.sendSubscriptionUpdateConfirmation(saved);

    return saved;
  }

  private async sendSubscriptionUpdateConfirmation(subscription: Subscription): Promise<void> {
    const customer = await this.stripe.customers.retrieve(subscription.stripeCustomerId);

    if ('deleted' in customer && customer.deleted) {
      return;
    }

    if (!customer.email) {
      return;
    }

    await this.notificationsService.send(subscription.tenantId, customer.email, 'subscription-updated', {
      planName: this.config.plans[subscription.plan]?.name ?? subscription.plan,
      status: subscription.status,
    });
  }

  private resolvePlanKey(priceId: string | undefined): string | null {
    if (!priceId) {
      return null;
    }

    const match = Object.entries(this.config.plans).find(([, plan]) => plan.stripePriceId === priceId);
    return match ? match[0] : null;
  }
}
