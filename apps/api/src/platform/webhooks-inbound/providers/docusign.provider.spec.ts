import { createHmac } from 'crypto';
import { docusignProvider } from './docusign.provider';

describe('docusignProvider', () => {
  const secret = 'connect-secret';

  const sign = (body: Buffer) => createHmac('sha256', secret).update(body).digest('base64');

  it('verifies a correctly-signed payload and extracts the event type', () => {
    const body = Buffer.from(JSON.stringify({ event: 'envelope-completed', data: { envelopeId: 'ds-1' } }));
    const headers = { 'x-docusign-signature-1': sign(body) };

    const result = docusignProvider.verify(body, headers, secret);

    expect(result).toEqual({
      verified: true,
      eventType: 'envelope-completed',
      payload: { event: 'envelope-completed', data: { envelopeId: 'ds-1' } },
    });
  });

  it('rejects a payload with a tampered body (signature no longer matches)', () => {
    const original = Buffer.from(JSON.stringify({ event: 'envelope-completed', data: { envelopeId: 'ds-1' } }));
    const tampered = Buffer.from(JSON.stringify({ event: 'envelope-completed', data: { envelopeId: 'ds-2' } }));
    const headers = { 'x-docusign-signature-1': sign(original) };

    const result = docusignProvider.verify(tampered, headers, secret);

    expect(result.verified).toBe(false);
  });

  it('rejects when the signature header is missing', () => {
    const body = Buffer.from(JSON.stringify({ event: 'envelope-completed' }));

    const result = docusignProvider.verify(body, {}, secret);

    expect(result.verified).toBe(false);
  });

  it('rejects when the signature header is repeated (array)', () => {
    const body = Buffer.from(JSON.stringify({ event: 'envelope-completed' }));

    const result = docusignProvider.verify(body, { 'x-docusign-signature-1': ['a', 'b'] }, secret);

    expect(result.verified).toBe(false);
  });

  it('rejects a wrong secret', () => {
    const body = Buffer.from(JSON.stringify({ event: 'envelope-completed' }));
    const headers = { 'x-docusign-signature-1': sign(body) };

    const result = docusignProvider.verify(body, headers, 'a-different-secret');

    expect(result.verified).toBe(false);
  });
});
