import { createHmac } from 'crypto';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CircuitBreakerRegistry } from '@platform/circuit-breaker/registry/circuit-breaker.registry';
import { DeadLetterQueueService } from '@platform/dead-letter-queue/dead-letter-queue.service';
import { PLATFORM_EVENTS } from '../events';
import { WebhooksService } from './webhooks.service';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';

describe('WebhooksService', () => {
  let webhookSubscriptions: {
    save: jest.Mock;
    create: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let webhookDeliveries: { save: jest.Mock; create: jest.Mock };
  let circuitBreakerRegistry: { wrap: jest.Mock };
  let deadLetterQueueService: { add: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let service: WebhooksService;
  let qb: { where: jest.Mock; andWhere: jest.Mock; getMany: jest.Mock };

  beforeEach(() => {
    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };
    webhookSubscriptions = {
      save: jest.fn(async (data) => ({ id: 'sub1', ...data }) as WebhookSubscription),
      create: jest.fn((data) => data),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    webhookDeliveries = {
      save: jest.fn(async (data) => ({ id: 'del1', ...data }) as WebhookDelivery),
      create: jest.fn((data) => data),
    };
    circuitBreakerRegistry = { wrap: jest.fn((_key: string, fn: () => Promise<unknown>) => fn()) };
    deadLetterQueueService = { add: jest.fn() };
    eventEmitter = { emit: jest.fn() };

    service = new WebhooksService(
      webhookSubscriptions as never,
      webhookDeliveries as never,
      circuitBreakerRegistry as unknown as CircuitBreakerRegistry,
      deadLetterQueueService as unknown as DeadLetterQueueService,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  describe('subscribe', () => {
    it('creates a subscription with a generated secret and no revocation', async () => {
      await service.subscribe('t1', 'https://example.com/hook', ['contract.created']);

      expect(webhookSubscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          url: 'https://example.com/hook',
          eventTypes: ['contract.created'],
          revokedAt: null,
        }),
      );
    });

    it('generates a different secret for each subscription', async () => {
      await service.subscribe('t1', 'https://a.example', []);
      await service.subscribe('t1', 'https://b.example', []);

      const [firstCall, secondCall] = webhookSubscriptions.create.mock.calls;
      expect(firstCall[0].secret).not.toBe(secondCall[0].secret);
    });
  });

  describe('unsubscribe', () => {
    it('throws NotFoundException when no subscription matches the tenant and id', async () => {
      webhookSubscriptions.findOne.mockResolvedValue(null);

      await expect(service.unsubscribe('t1', 'sub1')).rejects.toThrow(NotFoundException);
    });

    it('sets revokedAt on the matching subscription', async () => {
      const subscription = { id: 'sub1', tenantId: 't1', revokedAt: null } as WebhookSubscription;
      webhookSubscriptions.findOne.mockResolvedValue(subscription);

      await service.unsubscribe('t1', 'sub1');

      expect(webhookSubscriptions.save).toHaveBeenCalledWith(
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });
  });

  describe('deliver', () => {
    it("queries only that tenant's non-revoked subscriptions matching the event type", async () => {
      qb.getMany.mockResolvedValue([]);

      await service.deliver('t1', 'contract.created', {});

      expect(webhookSubscriptions.createQueryBuilder).toHaveBeenCalledWith('subscription');
      expect(qb.where).toHaveBeenCalledWith('subscription.tenantId = :tenantId', {
        tenantId: 't1',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('subscription.revokedAt IS NULL');
      expect(qb.andWhere).toHaveBeenCalledWith(':eventType = ANY(subscription.eventTypes)', {
        eventType: 'contract.created',
      });
    });

    it('delivers successfully on the first attempt: signs the body, saves the delivery, and emits WEBHOOK_DELIVERED', async () => {
      const subscription = {
        id: 'sub1',
        tenantId: 't1',
        url: 'https://example.com/hook',
        secret: 'shh',
      } as WebhookSubscription;
      qb.getMany.mockResolvedValue([subscription]);
      global.fetch = jest.fn().mockResolvedValue({ status: 200 }) as never;

      await service.deliver('t1', 'contract.created', { id: 'c1' });

      const expectedSignature = createHmac('sha256', 'shh')
        .update(JSON.stringify({ id: 'c1' }))
        .digest('hex');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/hook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'X-Webhook-Signature': expectedSignature }),
        }),
      );
      expect(webhookDeliveries.save).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 200, deliveredAt: expect.any(Date) }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.WEBHOOK_DELIVERED, {
        tenantId: 't1',
        url: 'https://example.com/hook',
        statusCode: 200,
      });
      expect(deadLetterQueueService.add).not.toHaveBeenCalled();
    });

    it('uses the target hostname as the circuit breaker key', async () => {
      const subscription = {
        id: 'sub1',
        tenantId: 't1',
        url: 'https://hooks.example.com/abc',
        secret: 'shh',
      } as WebhookSubscription;
      qb.getMany.mockResolvedValue([subscription]);
      global.fetch = jest.fn().mockResolvedValue({ status: 200 }) as never;

      await service.deliver('t1', 'contract.created', {});

      expect(circuitBreakerRegistry.wrap).toHaveBeenCalledWith(
        'hooks.example.com',
        expect.any(Function),
      );
    });

    it('retries after a network error and succeeds on the second attempt, without dead-lettering', async () => {
      const subscription = {
        id: 'sub1',
        tenantId: 't1',
        url: 'https://example.com/hook',
        secret: 'shh',
      } as WebhookSubscription;
      qb.getMany.mockResolvedValue([subscription]);
      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce({ status: 200 }) as never;

      await service.deliver('t1', 'contract.created', {});

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        PLATFORM_EVENTS.WEBHOOK_DELIVERY_FAILED,
        expect.objectContaining({ tenantId: 't1', attempt: 1 }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        PLATFORM_EVENTS.WEBHOOK_DELIVERED,
        expect.objectContaining({ statusCode: 200 }),
      );
      expect(deadLetterQueueService.add).not.toHaveBeenCalled();
    }, 10_000);

    it('dead-letters after exhausting all retry attempts on a persistent failure', async () => {
      const subscription = {
        id: 'sub1',
        tenantId: 't1',
        url: 'https://example.com/hook',
        secret: 'shh',
      } as WebhookSubscription;
      qb.getMany.mockResolvedValue([subscription]);
      global.fetch = jest.fn().mockResolvedValue({ status: 500 }) as never;

      await service.deliver('t1', 'contract.created', { id: 'c1' });

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(eventEmitter.emit).toHaveBeenCalledTimes(3);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        PLATFORM_EVENTS.WEBHOOK_DELIVERY_FAILED,
        expect.objectContaining({ attempt: 3 }),
      );
      expect(deadLetterQueueService.add).toHaveBeenCalledWith(
        'webhooks',
        { subscriptionId: 'sub1', eventType: 'contract.created', payload: { id: 'c1' } },
        expect.stringContaining('failed after 3 attempts'),
      );
    }, 10_000);
  });
});
