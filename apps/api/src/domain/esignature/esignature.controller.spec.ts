import { EsignatureController } from './esignature.controller';
import { EsignatureService } from './esignature.service';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';

describe('EsignatureController', () => {
  let service: { requestSignature: jest.Mock; listEnvelopes: jest.Mock };
  let tenantContext: { getTenantId: jest.Mock };
  let controller: EsignatureController;

  beforeEach(() => {
    service = { requestSignature: jest.fn(), listEnvelopes: jest.fn() };
    tenantContext = { getTenantId: jest.fn().mockResolvedValue('t1') };
    controller = new EsignatureController(
      service as unknown as EsignatureService,
      tenantContext as unknown as TenantContextService,
    );
  });

  it('requests a signature scoped to the resolved tenant', async () => {
    service.requestSignature.mockResolvedValue({ id: 'env-1' });

    const dto = { fileId: 'file-1', signerEmail: 'signer@example.com', signerName: 'Jane Signer' };
    await controller.requestSignature('c1', dto);

    expect(service.requestSignature).toHaveBeenCalledWith(
      't1',
      'c1',
      'file-1',
      'signer@example.com',
      'Jane Signer',
    );
  });

  it('lists envelopes scoped to the resolved tenant', async () => {
    service.listEnvelopes.mockResolvedValue([]);

    await controller.listEnvelopes('c1');

    expect(service.listEnvelopes).toHaveBeenCalledWith('t1', 'c1');
  });
});
