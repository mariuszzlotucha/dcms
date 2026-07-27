import { createHmac, randomBytes } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CircuitBreakerRegistry } from '@platform/circuit-breaker/registry/circuit-breaker.registry';
import { DeadLetterQueueService } from '@platform/dead-letter-queue/dead-letter-queue.service';
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../events';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { WebhookSubscription } from './entities/webhook-subscription.entity'

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;
const WEBHOOKS_ORIGINAL_EVENT = 'webhooks';

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(WebhookSubscription)
    private readonly webhookSubscriptions: Repository<WebhookSubscription>,
    @InjectRepository(WebhookDelivery)
    private readonly webhookDeliveries: Repository<WebhookDelivery>,
    private readonly circuitBreakerRegistry: CircuitBreakerRegistry,
    private readonly deadLetterQueueService: DeadLetterQueueService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async subscribe(tenantId: string, url: string, eventTypes: string[]): Promise<WebhookSubscription> {
    const secret = randomBytes(32).toString('base64url');

    return this.webhookSubscriptions.save(
      this.webhookSubscriptions.create({ tenantId, url, secret, eventTypes, revokedAt: null }),
    );
  }

  async unsubscribe(tenantId: string, subscriptionId: string): Promise<void> {
    const subscription = await this.webhookSubscriptions.findOne({ where: { id: subscriptionId, tenantId } });

    if (!subscription) {
      throw new NotFoundException('Webhook subscription not found');
    }

    subscription.revokedAt = new Date();
    await this.webhookSubscriptions.save(subscription);
  }

  async deliver(eventType: string, payload: unknown): Promise<void> {
    const subscriptions = await this.findMatchingSubscriptions(eventType);

    await Promise.all(
      subscriptions.map((subscription) => this.deliverToSubscription(subscription, eventType, payload)),
    );
  }

  private async findMatchingSubscriptions(eventType: string): Promise<WebhookSubscription[]> {
    return this.webhookSubscriptions
      .createQueryBuilder('subscription')
      .where('subscription.revokedAt IS NULL')
      .andWhere(':eventType = ANY(subscription.eventTypes)', { eventType })
      .getMany();
  }

  private async deliverToSubscription(
    subscription: WebhookSubscription,
    eventType: string,
    payload: unknown,
  ): Promise<void> {
    const body = JSON.stringify(payload);
    const signature = createHmac('sha256', subscription.secret).update(body).digest('hex');
    const hostname = new URL(subscription.url).hostname;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const delivery = this.webhookDeliveries.create({
        subscriptionId: subscription.id,
        eventType,
        payload,
        statusCode: null,
        attempt,
        deliveredAt: null,
      });

      try {
        const statusCode = await this.circuitBreakerRegistry.wrap(hostname, () =>
          this.sendRequest(subscription.url, body, signature),
        );

        delivery.statusCode = statusCode;

        if (statusCode >= 200 && statusCode < 300) {
          delivery.deliveredAt = new Date();
          await this.webhookDeliveries.save(delivery);

          this.eventEmitter.emit(
            PLATFORM_EVENTS.WEBHOOK_DELIVERED,
            { tenantId: subscription.tenantId, url: subscription.url, statusCode } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.WEBHOOK_DELIVERED],
          );
          return;
        }

        await this.webhookDeliveries.save(delivery);
      } catch {
        await this.webhookDeliveries.save(delivery);
      }

      this.eventEmitter.emit(
        PLATFORM_EVENTS.WEBHOOK_DELIVERY_FAILED,
        { tenantId: subscription.tenantId, url: subscription.url, attempt } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.WEBHOOK_DELIVERY_FAILED],
      );

      if (attempt < MAX_ATTEMPTS) {
        await this.delay(RETRY_DELAY_MS);
      }
    }

    await this.deadLetterQueueService.add(
      WEBHOOKS_ORIGINAL_EVENT,
      { subscriptionId: subscription.id, eventType, payload },
      `Delivery to ${subscription.url} failed after ${MAX_ATTEMPTS} attempts`,
    );
  }

  private async sendRequest(url: string, body: string, signature: string): Promise<number> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': signature },
      body,
    });

    return response.status;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
