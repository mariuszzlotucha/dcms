import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';

describe('IntegrationsController', () => {
  let service: { listConnections: jest.Mock; connect: jest.Mock; disconnect: jest.Mock };
  let tenantContext: { getTenantId: jest.Mock };
  let controller: IntegrationsController;

  beforeEach(() => {
    service = { listConnections: jest.fn(), connect: jest.fn(), disconnect: jest.fn() };
    tenantContext = { getTenantId: jest.fn().mockResolvedValue('t1') };
    controller = new IntegrationsController(
      service as unknown as IntegrationsService,
      tenantContext as unknown as TenantContextService,
    );
  });

  it('lists connections scoped to the resolved tenant', async () => {
    service.listConnections.mockResolvedValue([]);

    await controller.listConnections();

    expect(service.listConnections).toHaveBeenCalledWith('t1');
  });

  it('connects an integration with the given sync url', async () => {
    await controller.connect('salesforce', { syncUrl: 'https://example.com/hook' });

    expect(service.connect).toHaveBeenCalledWith('t1', 'salesforce', 'https://example.com/hook');
  });

  it('disconnects an integration', async () => {
    await controller.disconnect('hubspot');

    expect(service.disconnect).toHaveBeenCalledWith('t1', 'hubspot');
  });
});
