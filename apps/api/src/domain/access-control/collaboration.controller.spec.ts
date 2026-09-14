import { Request } from 'express';
import { CollaborationController } from './collaboration.controller';
import { AccessControlService } from './access-control.service';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';

describe('CollaborationController', () => {
  let service: { addComment: jest.Mock; listComments: jest.Mock; startSession: jest.Mock };
  let tenantContext: { getTenantId: jest.Mock };
  let controller: CollaborationController;

  const requestAs = (userId: string): Request => ({ user: { userId } }) as unknown as Request;

  beforeEach(() => {
    service = { addComment: jest.fn(), listComments: jest.fn(), startSession: jest.fn() };
    tenantContext = { getTenantId: jest.fn().mockResolvedValue('t1') };
    controller = new CollaborationController(
      service as unknown as AccessControlService,
      tenantContext as unknown as TenantContextService,
    );
  });

  it('adds a comment scoped to the resolved tenant and authenticated author', async () => {
    service.addComment.mockResolvedValue({ id: 'comment-1' });

    await controller.addComment('c1', { body: 'looks good' }, requestAs('u1'));

    expect(service.addComment).toHaveBeenCalledWith('t1', 'c1', 'u1', 'looks good');
  });

  it('lists comments scoped to the resolved tenant', async () => {
    service.listComments.mockResolvedValue([]);

    await controller.listComments('c1');

    expect(service.listComments).toHaveBeenCalledWith('t1', 'c1');
  });

  it('starts a collaboration session scoped to the resolved tenant', async () => {
    service.startSession.mockResolvedValue({ id: 'session-1' });

    await controller.startSession('c1', requestAs('u1'));

    expect(service.startSession).toHaveBeenCalledWith('t1', 'c1', 'u1');
  });
});
