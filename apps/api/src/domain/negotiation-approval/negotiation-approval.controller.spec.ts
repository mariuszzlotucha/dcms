import { Request } from 'express';
import { NegotiationApprovalController } from './negotiation-approval.controller';
import { NegotiationApprovalService } from './negotiation-approval.service';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';

describe('NegotiationApprovalController', () => {
  let service: {
    assignRole: jest.Mock;
    listRoles: jest.Mock;
    listApprovalRequests: jest.Mock;
    grantApproval: jest.Mock;
    rejectApproval: jest.Mock;
    requestRevision: jest.Mock;
  };
  let tenantContext: { getTenantId: jest.Mock };
  let controller: NegotiationApprovalController;

  const requestAs = (userId: string): Request => ({ user: { userId } }) as unknown as Request;

  beforeEach(() => {
    service = {
      assignRole: jest.fn(),
      listRoles: jest.fn(),
      listApprovalRequests: jest.fn(),
      grantApproval: jest.fn(),
      rejectApproval: jest.fn(),
      requestRevision: jest.fn(),
    };
    tenantContext = { getTenantId: jest.fn().mockResolvedValue('t1') };
    controller = new NegotiationApprovalController(
      service as unknown as NegotiationApprovalService,
      tenantContext as unknown as TenantContextService,
    );
  });

  it('assigns a role scoped to the resolved tenant', async () => {
    service.assignRole.mockResolvedValue({ id: 'role-1' });

    await controller.assignRole('c1', { userId: 'u1', role: 'approver' });

    expect(service.assignRole).toHaveBeenCalledWith('t1', 'c1', 'u1', 'approver');
  });

  it('grants approval as the authenticated caller', async () => {
    service.grantApproval.mockResolvedValue({ id: 'req-1', status: 'granted' });

    await controller.grantApproval('c1', requestAs('approver-1'));

    expect(service.grantApproval).toHaveBeenCalledWith('t1', 'c1', 'approver-1');
  });

  it('rejects approval with a reason as the authenticated caller', async () => {
    service.rejectApproval.mockResolvedValue({ id: 'req-1', status: 'rejected' });

    await controller.rejectApproval('c1', { reason: 'missing indemnity clause' }, requestAs('approver-1'));

    expect(service.rejectApproval).toHaveBeenCalledWith('t1', 'c1', 'approver-1', 'missing indemnity clause');
  });

  it('requests a revision as the authenticated caller', async () => {
    await controller.requestRevision('c1', { comment: 'please fix section 3' }, requestAs('u1'));

    expect(service.requestRevision).toHaveBeenCalledWith('t1', 'c1', 'u1', 'please fix section 3');
  });
});
