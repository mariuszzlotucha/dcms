import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';

describe('ApiKeysController', () => {
  let apiKeysService: { createKey: jest.Mock; listKeys: jest.Mock; revokeKey: jest.Mock };
  let tenantContext: { getTenantId: jest.Mock };
  let controller: ApiKeysController;

  beforeEach(() => {
    apiKeysService = { createKey: jest.fn(), listKeys: jest.fn(), revokeKey: jest.fn() };
    tenantContext = { getTenantId: jest.fn().mockResolvedValue('t1') };
    controller = new ApiKeysController(
      apiKeysService as unknown as ApiKeysService,
      tenantContext as unknown as TenantContextService,
    );
  });

  it('creates a key scoped to the resolved tenant', async () => {
    await controller.createKey({ label: 'CI key', scopes: ['read'] });

    expect(apiKeysService.createKey).toHaveBeenCalledWith('t1', 'CI key', ['read']);
  });

  it('lists keys scoped to the resolved tenant', async () => {
    await controller.listKeys();

    expect(apiKeysService.listKeys).toHaveBeenCalledWith('t1');
  });

  it('revokes a key scoped to the resolved tenant', async () => {
    await controller.revokeKey('k1');

    expect(apiKeysService.revokeKey).toHaveBeenCalledWith('t1', 'k1');
  });
});
