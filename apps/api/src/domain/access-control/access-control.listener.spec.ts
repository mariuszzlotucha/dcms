import { AccessControlListener } from './access-control.listener';
import { AccessControlService } from './access-control.service';

describe('AccessControlListener', () => {
  let service: { seedDefaultAccessPolicy: jest.Mock; resolvePendingInvites: jest.Mock };
  let listener: AccessControlListener;

  beforeEach(() => {
    service = { seedDefaultAccessPolicy: jest.fn(), resolvePendingInvites: jest.fn() };
    listener = new AccessControlListener(service as unknown as AccessControlService);
  });

  it('seeds the default access policy on tenant.created', async () => {
    await listener.handleTenantCreated({ tenantId: 't1', name: 'Acme', plan: 'free' });

    expect(service.seedDefaultAccessPolicy).toHaveBeenCalledWith('t1');
  });

  it('resolves pending invites on auth.user.registered', async () => {
    await listener.handleAuthUserRegistered({ tenantId: 't1', userId: 'u1', email: 'new@example.com' });

    expect(service.resolvePendingInvites).toHaveBeenCalledWith('t1', 'new@example.com', 'u1');
  });
});
