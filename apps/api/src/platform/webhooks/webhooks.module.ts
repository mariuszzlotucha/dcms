import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { WebhooksService } from './webhooks.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([WebhookSubscription, WebhookDelivery])],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
