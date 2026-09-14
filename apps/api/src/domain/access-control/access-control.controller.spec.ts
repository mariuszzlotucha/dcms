import { Request } from 'express';
import { AccessControlController } from './access-control.controller';
import { AccessControlService } from './access-control.service';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';

describe('AccessControlController', () => {
  let service: {
    grantAccess: jest.Mock;
    revokeAccess: jest.Mock;
    listAccess: jest.Mock;
    inviteParticipant: jest.Mock;
  };
  let tenantContext: { getTenantId: jest.Mock };
  let controller: AccessControlController;

  const requestAs = (userId: string): Request => ({ user: { userId } }) as unknown as Request;

  beforeEach(() => {
    service = {
      grantAccess: jest.fn(),
      revokeAccess: jest.fn(),
      listAccess: jest.fn(),
      inviteParticipant: jest.fn(),
    };
    tenantContext = { getTenantId: jest.fn().mockResolvedValue('t1') };
    controller = new AccessControlController(
      service as unknown as AccessControlService,
      tenantContext as unknown as TenantContextService,
    );
  });

  it('grants access scoped to the resolved tenant and authenticated granter', async () => {
    service.grantAccess.mockResolvedValue({ id: 'grant-1' });

    await controller.grantAccess('c1', { userId: 'u1', permission: 'edit' }, requestAs('admin-1'));

    expect(service.grantAccess).toHaveBeenCalledWith('t1', 'c1', 'u1', 'edit', 'admin-1');
  });

  it('revokes access scoped to the resolved tenant', async () => {
    await controller.revokeAccess('c1', 'u1');

    expect(service.revokeAccess).toHaveBeenCalledWith('t1', 'c1', 'u1');
  });

  it('lists access grants scoped to the resolved tenant', async () => {
    service.listAccess.mockResolvedValue([]);

    await controller.listAccess('c1');

    expect(service.listAccess).toHaveBeenCalledWith('t1', 'c1');
  });

  it('invites a participant scoped to the resolved tenant and authenticated inviter', async () => {
    service.inviteParticipant.mockResolvedValue({ id: 'invite-1' });

    await controller.inviteParticipant(
      'c1',
      { email: 'stranger@example.com', permission: 'view' },
      requestAs('admin-1'),
    );

    expect(service.inviteParticipant).toHaveBeenCalledWith(
      't1',
      'c1',
      'stranger@example.com',
      'view',
      'admin-1',
    );
  });
});
