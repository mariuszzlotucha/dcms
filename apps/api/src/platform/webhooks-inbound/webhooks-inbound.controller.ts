import { Controller, HttpCode, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Request } from 'express';
import { SecretsService } from '@platform/secrets/secrets.service';
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../events';
import { WebhookProvider } from './webhooks-inbound.module';
import { stripeProvider } from './providers/stripe.provider';

const WEBHOOK_PROVIDERS: Record<string, WebhookProvider> = {
  stripe: stripeProvider,
};

@Controller('webhooks-inbound')
export class WebhooksInboundController {
  constructor(
    private readonly secretsService: SecretsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post(':provider')
  @HttpCode(200)
  receive(@Param('provider') providerName: string, @Req() request: RawBodyRequest<Request>): { received: boolean } {
    const provider = WEBHOOK_PROVIDERS[providerName];

    if (!provider) {
      throw new NotFoundException(`Unknown webhook provider: ${providerName}`);
    }

    if (!request.rawBody) {
      throw new Error('Raw body unavailable — rawBody must be enabled in main.ts');
    }

    const secret = this.secretsService.getProviderSecret(provider.secretName);
    const result = provider.verify(request.rawBody, request.headers, secret);

    this.eventEmitter.emit(
      PLATFORM_EVENTS.WEBHOOK_RECEIVED,
      {
        provider: provider.name,
        verified: result.verified,
        eventType: result.eventType,
        payload: result.payload,
      } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.WEBHOOK_RECEIVED],
    );

    return { received: true };
  }
}
