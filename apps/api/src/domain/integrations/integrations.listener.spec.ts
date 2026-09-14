import { IntegrationsListener } from './integrations.listener';
import { IntegrationsService } from './integrations.service';

describe('IntegrationsListener', () => {
  let service: {
    initializeTenantConfig: jest.Mock;
    handleFeatureFlagDisabled: jest.Mock;
    requestSync: jest.Mock;
  };
  let listener: IntegrationsListener;

  beforeEach(() => {
    service = {
      initializeTenantConfig: jest.fn(),
      handleFeatureFlagDisabled: jest.fn(),
      requestSync: jest.fn(),
    };
    listener = new IntegrationsListener(service as unknown as IntegrationsService);
  });

  it('reacts to tenant.created by initializing the tenant integration config', async () => {
    await listener.handleTenantCreated({ tenantId: 't1', name: 'Acme', plan: 'free' });

    expect(service.initializeTenantConfig).toHaveBeenCalledWith('t1');
  });

  it('disconnects the tenant when the integrations flag is toggled off', async () => {
    await listener.handleFeatureFlagToggled({ tenantId: 't1', flagKey: 'integrations', enabled: false });

    expect(service.handleFeatureFlagDisabled).toHaveBeenCalledWith('t1');
  });

  it('ignores featureFlag.toggled for a different flag', async () => {
    await listener.handleFeatureFlagToggled({ tenantId: 't1', flagKey: 'beta_dashboard', enabled: false });

    expect(service.handleFeatureFlagDisabled).not.toHaveBeenCalled();
  });

  it('ignores featureFlag.toggled when the integrations flag is turned on', async () => {
    await listener.handleFeatureFlagToggled({ tenantId: 't1', flagKey: 'integrations', enabled: true });

    expect(service.handleFeatureFlagDisabled).not.toHaveBeenCalled();
  });

  it('reacts to contract.created by requesting a sync', async () => {
    await listener.handleContractCreated({ tenantId: 't1', contractId: 'c1', templateId: null, createdBy: 'u1' });

    expect(service.requestSync).toHaveBeenCalledWith('t1', 'c1');
  });

  it('reacts to contract.statusChanged by requesting a sync', async () => {
    await listener.handleContractStatusChanged({
      tenantId: 't1',
      contractId: 'c1',
      previousStatus: 'draft',
      newStatus: 'in_review',
    });

    expect(service.requestSync).toHaveBeenCalledWith('t1', 'c1');
  });
});
