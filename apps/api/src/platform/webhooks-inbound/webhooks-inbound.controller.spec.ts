import { BadRequestException, NotFoundException, RawBodyRequest } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Request } from 'express';
import Stripe from 'stripe';
import { WebhooksInboundController } from './webhooks-inbound.controller';
import { SecretsService } from '@platform/secrets/secrets.service';
import { PLATFORM_EVENTS } from '../events';

describe('WebhooksInboundController', () => {
  const secret = 'whsec_test_secret';
  let secretsService: { getProviderSecret: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let controller: WebhooksInboundController;

  const buildRequest = (
    rawBody: Buffer,
    headers: Record<string, string>,
  ): RawBodyRequest<Request> =>
    ({
      rawBody,
      headers,
      path: '/webhooks-inbound/stripe',
      ip: '127.0.0.1',
    }) as unknown as RawBodyRequest<Request>;

  beforeEach(() => {
    secretsService = { getProviderSecret: jest.fn().mockReturnValue(secret) };
    eventEmitter = { emit: jest.fn() };
    controller = new WebhooksInboundController(
      secretsService as unknown as SecretsService,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  it('rejects an unknown provider', () => {
    const request = buildRequest(Buffer.from('{}'), {});

    expect(() => controller.receive('unknown', request)).toThrow(NotFoundException);
  });

  it('rejects a webhook with a missing signature: 400, no WEBHOOK_RECEIVED, emits security.requestRejected', () => {
    const rawBody = Buffer.from(JSON.stringify({ type: 'checkout.session.completed' }));
    const request = buildRequest(rawBody, {});

    expect(() => controller.receive('stripe', request)).toThrow(BadRequestException);
    expect(eventEmitter.emit).not.toHaveBeenCalledWith(
      PLATFORM_EVENTS.WEBHOOK_RECEIVED,
      expect.anything(),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      PLATFORM_EVENTS.SECURITY_REQUEST_REJECTED,
      expect.objectContaining({ reason: expect.stringContaining('stripe') }),
    );
  });

  it('rejects a webhook with a forged/invalid signature the same way', () => {
    const rawBody = Buffer.from(JSON.stringify({ type: 'checkout.session.completed' }));
    const request = buildRequest(rawBody, { 'stripe-signature': 't=1,v1=deadbeef' });

    expect(() => controller.receive('stripe', request)).toThrow(BadRequestException);
    expect(eventEmitter.emit).not.toHaveBeenCalledWith(
      PLATFORM_EVENTS.WEBHOOK_RECEIVED,
      expect.anything(),
    );
  });

  it('accepts and emits WEBHOOK_RECEIVED for a correctly signed payload', () => {
    const payload = JSON.stringify({
      id: 'evt_1',
      object: 'event',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1' } },
    });
    const rawBody = Buffer.from(payload);
    const header = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
    });
    const request = buildRequest(rawBody, { 'stripe-signature': header });

    const result = controller.receive('stripe', request);

    expect(result).toEqual({ received: true });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      PLATFORM_EVENTS.WEBHOOK_RECEIVED,
      expect.objectContaining({
        provider: 'stripe',
        verified: true,
        eventType: 'checkout.session.completed',
      }),
    );
  });
});
