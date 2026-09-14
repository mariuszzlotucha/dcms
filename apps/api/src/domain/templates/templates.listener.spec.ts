import { TemplatesListener } from './templates.listener';
import { TemplatesService } from './templates.service';

describe('TemplatesListener', () => {
  let templatesService: { seedStarterTemplates: jest.Mock; seedPremiumTemplates: jest.Mock };
  let listener: TemplatesListener;

  beforeEach(() => {
    templatesService = { seedStarterTemplates: jest.fn(), seedPremiumTemplates: jest.fn() };
    listener = new TemplatesListener(templatesService as unknown as TemplatesService);
  });

  describe('handleTenantCreated', () => {
    it('seeds the starter template catalog for the new tenant', async () => {
      await listener.handleTenantCreated({ tenantId: 't1', name: 'Acme', plan: 'free' });

      expect(templatesService.seedStarterTemplates).toHaveBeenCalledWith('t1');
    });
  });

  describe('handleFeatureFlagToggled', () => {
    it('seeds the premium catalog when premium_templates is enabled', async () => {
      await listener.handleFeatureFlagToggled({
        tenantId: 't1',
        flagKey: 'premium_templates',
        enabled: true,
      });

      expect(templatesService.seedPremiumTemplates).toHaveBeenCalledWith('t1');
    });

    it('ignores unrelated flags', async () => {
      await listener.handleFeatureFlagToggled({
        tenantId: 't1',
        flagKey: 'beta_dashboard',
        enabled: true,
      });

      expect(templatesService.seedPremiumTemplates).not.toHaveBeenCalled();
    });

    it('ignores premium_templates being disabled', async () => {
      await listener.handleFeatureFlagToggled({
        tenantId: 't1',
        flagKey: 'premium_templates',
        enabled: false,
      });

      expect(templatesService.seedPremiumTemplates).not.toHaveBeenCalled();
    });
  });
});
