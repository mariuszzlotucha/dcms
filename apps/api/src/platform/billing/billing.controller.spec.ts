import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';

describe('BillingController', () => {
  let billingService: {
    createCheckoutSession: jest.Mock;
    getSubscription: jest.Mock;
    changePlan: jest.Mock;
  };
  let tenantContext: { getTenantId: jest.Mock };
  let controller: BillingController;

  beforeEach(() => {
    billingService = {
      createCheckoutSession: jest.fn(),
      getSubscription: jest.fn(),
      changePlan: jest.fn(),
    };
    tenantContext = { getTenantId: jest.fn().mockResolvedValue('t1') };
    controller = new BillingController(
      billingService as unknown as BillingService,
      tenantContext as unknown as TenantContextService,
    );
  });

  it('creates a checkout session scoped to the resolved tenant and wraps the URL', async () => {
    billingService.createCheckoutSession.mockResolvedValue('https://checkout.stripe.com/session');

    const result = await controller.createCheckoutSession({ planKey: 'pro' });

    expect(billingService.createCheckoutSession).toHaveBeenCalledWith('t1', 'pro');
    expect(result).toEqual({ url: 'https://checkout.stripe.com/session' });
  });

  it('gets the subscription for the resolved tenant', async () => {
    await controller.getSubscription();

    expect(billingService.getSubscription).toHaveBeenCalledWith('t1');
  });

  it('changes the plan for the resolved tenant', async () => {
    await controller.changePlan({ planKey: 'pro' });

    expect(billingService.changePlan).toHaveBeenCalledWith('t1', 'pro');
  });
});
