import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EVENTS, EventPayloadMap } from '@';
import { EsignatureService } from './esignature.service';

interface DocuSignConnectPayload {
  data?: {
    envelopeId?: string;
    envelopeSummary?: {
      declinedReason?: string;
    };
  };
}

const RELEVANT_EVENT_TYPES = new Set([
  'envelope-completed',
  'envelope-declined',
  'envelope-voided',
]);

// architecture doc 1.4: esignature "Does NOT store provider logic itself" —
// verifying and routing the DocuSign Connect webhook is platform/
// webhooks-inbound's job (mirrors how billing.listener.ts consumes
// WEBHOOK_RECEIVED for Stripe); this listener only reacts to it.
@Injectable()
export class EsignatureListener {
  constructor(private readonly esignatureService: EsignatureService) {}

  @OnEvent(EVENTS.WEBHOOK_RECEIVED)
  async handleWebhookReceived(
    event: EventPayloadMap[typeof EVENTS.WEBHOOK_RECEIVED],
  ): Promise<void> {
    if (
      !event.verified ||
      event.provider !== 'docusign' ||
      !RELEVANT_EVENT_TYPES.has(event.eventType)
    ) {
      return;
    }

    const payload = event.payload as DocuSignConnectPayload;
    const envelopeId = payload.data?.envelopeId;

    if (!envelopeId) {
      return;
    }

    switch (event.eventType) {
      case 'envelope-completed':
        await this.esignatureService.markCompleted(envelopeId, new Date());
        break;
      case 'envelope-declined':
        await this.esignatureService.markDeclined(
          envelopeId,
          payload.data?.envelopeSummary?.declinedReason ?? 'Declined by signer',
        );
        break;
      case 'envelope-voided':
        await this.esignatureService.markExpired(envelopeId);
        break;
    }
  }
}
