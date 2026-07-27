import { Module } from '@nestjs/common';
import { WebhooksInboundController } from './webhooks-inbound.controller';

export interface WebhookVerificationResult {
  verified: boolean;
  eventType: string;
  payload: unknown;
}

export interface WebhookProvider {
  name: string;
  secretName: string;
  verify(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
    secret: string,
  ): WebhookVerificationResult;
}

@Module({
  controllers: [WebhooksInboundController],
})
export class WebhooksInboundModule {}
