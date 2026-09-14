import { EsignatureListener } from './esignature.listener';
import { EsignatureService } from './esignature.service';

describe('EsignatureListener', () => {
  let service: { markCompleted: jest.Mock; markDeclined: jest.Mock; markExpired: jest.Mock };
  let listener: EsignatureListener;

  beforeEach(() => {
    service = { markCompleted: jest.fn(), markDeclined: jest.fn(), markExpired: jest.fn() };
    listener = new EsignatureListener(service as unknown as EsignatureService);
  });

  it('marks the envelope completed on a verified envelope-completed callback', async () => {
    await listener.handleWebhookReceived({
      provider: 'docusign',
      verified: true,
      eventType: 'envelope-completed',
      payload: { data: { envelopeId: 'ds-1' } },
    });

    expect(service.markCompleted).toHaveBeenCalledWith('ds-1', expect.any(Date));
  });

  it('marks the envelope declined with the reason from the payload', async () => {
    await listener.handleWebhookReceived({
      provider: 'docusign',
      verified: true,
      eventType: 'envelope-declined',
      payload: { data: { envelopeId: 'ds-1', envelopeSummary: { declinedReason: 'wrong recipient' } } },
    });

    expect(service.markDeclined).toHaveBeenCalledWith('ds-1', 'wrong recipient');
  });

  it('marks the envelope expired on envelope-voided', async () => {
    await listener.handleWebhookReceived({
      provider: 'docusign',
      verified: true,
      eventType: 'envelope-voided',
      payload: { data: { envelopeId: 'ds-1' } },
    });

    expect(service.markExpired).toHaveBeenCalledWith('ds-1');
  });

  it('ignores webhooks from other providers', async () => {
    await listener.handleWebhookReceived({
      provider: 'stripe',
      verified: true,
      eventType: 'envelope-completed',
      payload: { data: { envelopeId: 'ds-1' } },
    });

    expect(service.markCompleted).not.toHaveBeenCalled();
  });

  it('ignores unverified webhooks even if the payload looks legitimate', async () => {
    await listener.handleWebhookReceived({
      provider: 'docusign',
      verified: false,
      eventType: 'envelope-completed',
      payload: { data: { envelopeId: 'ds-1' } },
    });

    expect(service.markCompleted).not.toHaveBeenCalled();
  });

  it('ignores an event type it does not handle', async () => {
    await listener.handleWebhookReceived({
      provider: 'docusign',
      verified: true,
      eventType: 'envelope-sent',
      payload: { data: { envelopeId: 'ds-1' } },
    });

    expect(service.markCompleted).not.toHaveBeenCalled();
    expect(service.markDeclined).not.toHaveBeenCalled();
    expect(service.markExpired).not.toHaveBeenCalled();
  });
});
