import { NegotiationApprovalListener } from './negotiation-approval.listener';
import { NegotiationApprovalService } from './negotiation-approval.service';

describe('NegotiationApprovalListener', () => {
  let service: { seedDefaultWorkflow: jest.Mock; createApprovalRequestForSubmission: jest.Mock };
  let listener: NegotiationApprovalListener;

  beforeEach(() => {
    service = { seedDefaultWorkflow: jest.fn(), createApprovalRequestForSubmission: jest.fn() };
    listener = new NegotiationApprovalListener(service as unknown as NegotiationApprovalService);
  });

  it('seeds the default workflow on tenant.created', async () => {
    await listener.handleTenantCreated({ tenantId: 't1', name: 'Acme', plan: 'free' });

    expect(service.seedDefaultWorkflow).toHaveBeenCalledWith('t1');
  });

  it('creates an approval request on contract.submittedForApproval', async () => {
    await listener.handleContractSubmittedForApproval({
      tenantId: 't1',
      contractId: 'c1',
      submittedBy: 'u1',
    });

    expect(service.createApprovalRequestForSubmission).toHaveBeenCalledWith('t1', 'c1');
  });
});
