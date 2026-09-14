import { DocuSignEsignatureProvider } from './docusign-esignature.provider';
import { SecretsService } from '@platform/secrets/secrets.service';

describe('DocuSignEsignatureProvider', () => {
  let secretsService: { getProviderSecret: jest.Mock };
  let provider: DocuSignEsignatureProvider;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    secretsService = { getProviderSecret: jest.fn().mockReturnValue('access-token') };
    provider = new DocuSignEsignatureProvider(secretsService as unknown as SecretsService, {
      docusignBaseUri: 'https://demo.docusign.net',
      docusignAccountId: 'account-1',
    });
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('exposes its provider name', () => {
    expect(provider.name).toBe('docusign');
  });

  it('uses the whole document name as the extension when it has no dot', async () => {
    // String.prototype.split('.').pop() never returns undefined for a
    // string input, so the `?? 'pdf'` fallback in the source never actually
    // fires — this documents the real (not the intended) behavior.
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ envelopeId: 'ds-envelope-2' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await provider.sendEnvelope({
      signerEmail: 'signer@example.com',
      signerName: 'Jane Signer',
      documentName: 'contract-without-extension',
      fileBuffer: Buffer.from('pdf-bytes'),
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.documents[0].fileExtension).toBe('contract-without-extension');
  });

  it('posts a base64-encoded envelope to the accounts envelopes endpoint with a bearer token', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ envelopeId: 'ds-envelope-1' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await provider.sendEnvelope({
      signerEmail: 'signer@example.com',
      signerName: 'Jane Signer',
      documentName: 'contract.pdf',
      fileBuffer: Buffer.from('pdf-bytes'),
    });

    expect(result).toEqual({ envelopeId: 'ds-envelope-1' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://demo.docusign.net/restapi/v2.1/accounts/account-1/envelopes',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    );

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.documents[0].documentBase64).toBe(Buffer.from('pdf-bytes').toString('base64'));
    expect(body.recipients.signers[0]).toEqual(
      expect.objectContaining({ email: 'signer@example.com', name: 'Jane Signer' }),
    );
  });

  it('throws when DocuSign responds with a non-2xx status', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;

    await expect(
      provider.sendEnvelope({
        signerEmail: 'signer@example.com',
        signerName: 'Jane Signer',
        documentName: 'contract.pdf',
        fileBuffer: Buffer.from('pdf-bytes'),
      }),
    ).rejects.toThrow('DocuSign envelope creation failed with status 401');
  });
});
