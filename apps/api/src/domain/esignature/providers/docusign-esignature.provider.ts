import { Inject, Injectable } from '@nestjs/common';
import { SecretsService } from '@platform/secrets/secrets.service';
import { ESIGNATURE_MODULE_CONFIG, EsignatureModuleConfig } from '../esignature.config';
import {
  EsignatureProvider,
  SendEnvelopeInput,
  SendEnvelopeResult,
} from './esignature-provider.interface';

// Deliberately a raw fetch() against DocuSign's REST API rather than the
// official docusign-esign SDK — nothing else in this repo depends on it,
// and the whole point of this class is to be a thin adapter (see
// EsignatureProvider). Assumes a pre-provisioned, long-lived access token
// (the 'docusignAccessToken' secret) — the JWT/OAuth consent flow to obtain
// and refresh that token is an operational concern, not built here.
@Injectable()
export class DocuSignEsignatureProvider implements EsignatureProvider {
  readonly name = 'docusign' as const;

  constructor(
    private readonly secretsService: SecretsService,
    @Inject(ESIGNATURE_MODULE_CONFIG) private readonly config: EsignatureModuleConfig,
  ) {}

  async sendEnvelope(input: SendEnvelopeInput): Promise<SendEnvelopeResult> {
    const accessToken = this.secretsService.getProviderSecret('docusignAccessToken');
    const fileExtension = input.documentName.split('.').pop() ?? 'pdf';

    const response = await fetch(
      `${this.config.docusignBaseUri}/restapi/v2.1/accounts/${this.config.docusignAccountId}/envelopes`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailSubject: `Please sign: ${input.documentName}`,
          documents: [
            {
              documentBase64: input.fileBuffer.toString('base64'),
              name: input.documentName,
              fileExtension,
              documentId: '1',
            },
          ],
          recipients: {
            signers: [
              {
                email: input.signerEmail,
                name: input.signerName,
                recipientId: '1',
                routingOrder: '1',
              },
            ],
          },
          status: 'sent',
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`DocuSign envelope creation failed with status ${response.status}`);
    }

    const body = (await response.json()) as { envelopeId: string };
    return { envelopeId: body.envelopeId };
  }
}
