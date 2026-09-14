import { createHmac, timingSafeEqual } from 'crypto';
import { WebhookProvider, WebhookVerificationResult } from '../webhooks-inbound.module';

// DocuSign Connect's HMAC scheme: base64(HMAC-SHA256(rawBody, connectSecret))
// in the X-DocuSign-Signature-1 header — see
// https://developers.docusign.com/platform/webhooks/connect/hmac/
export const docusignProvider: WebhookProvider = {
  name: 'docusign',
  secretName: 'docusignConnectSecret',
  verify(rawBody, headers, secret): WebhookVerificationResult {
    const signature = headers['x-docusign-signature-1'];

    if (!signature || Array.isArray(signature)) {
      return { verified: false, eventType: 'unknown', payload: null };
    }

    const expected = createHmac('sha256', secret).update(rawBody).digest('base64');
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(signature);

    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      return { verified: false, eventType: 'unknown', payload: null };
    }

    try {
      const event = JSON.parse(rawBody.toString('utf8')) as { event?: string };
      return { verified: true, eventType: event.event ?? 'unknown', payload: event };
    } catch {
      return { verified: false, eventType: 'unknown', payload: null };
    }
  },
};
