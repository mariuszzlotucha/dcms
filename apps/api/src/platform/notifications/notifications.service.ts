import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Resend } from 'resend';
import { SecretsService } from '@platform/secrets/secrets.service';
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../events';
import { NOTIFICATION_TEMPLATES, NotificationTemplateDataMap, NotificationTemplateName, RenderedTemplate } from './templates';
import { NOTIFICATIONS_MODULE_CONFIG, NotificationsModuleConfig } from './notifications.config';

@Injectable()
export class NotificationsService {
  private readonly resend: Resend;

  constructor(
    @Inject(NOTIFICATIONS_MODULE_CONFIG)
    private readonly config: NotificationsModuleConfig,
    private readonly secretsService: SecretsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.resend = new Resend(this.secretsService.getProviderSecret('resend'));
  }

  async send<T extends NotificationTemplateName>(
    tenantId: string,
    recipient: string,
    template: T,
    data: NotificationTemplateDataMap[T],
  ): Promise<void> {
    const render = NOTIFICATION_TEMPLATES[template] as (input: NotificationTemplateDataMap[T]) => RenderedTemplate;
    const { subject, body } = render(data);

    try {
      const result = await this.resend.emails.send({
        from: this.config.fromAddress,
        to: recipient,
        subject,
        text: body,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      this.eventEmitter.emit(
        PLATFORM_EVENTS.NOTIFICATION_SENT,
        { tenantId, recipient, template, channel: 'email' } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.NOTIFICATION_SENT],
      );
    } catch (error) {
      this.eventEmitter.emit(
        PLATFORM_EVENTS.NOTIFICATION_FAILED,
        {
          tenantId,
          reason: error instanceof Error ? error.message : 'Unknown error',
        } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.NOTIFICATION_FAILED],
      );
    }
  }
}
