import { NotificationsRemindersController } from './notifications-reminders.controller';
import { NotificationsRemindersService } from './notifications-reminders.service';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';

describe('NotificationsRemindersController', () => {
  let service: { listReminders: jest.Mock };
  let tenantContext: { getTenantId: jest.Mock };
  let controller: NotificationsRemindersController;

  beforeEach(() => {
    service = { listReminders: jest.fn() };
    tenantContext = { getTenantId: jest.fn().mockResolvedValue('t1') };
    controller = new NotificationsRemindersController(
      service as unknown as NotificationsRemindersService,
      tenantContext as unknown as TenantContextService,
    );
  });

  it('lists reminders scoped to the resolved tenant and the requested contract', async () => {
    service.listReminders.mockResolvedValue([]);

    await controller.listReminders('c1');

    expect(service.listReminders).toHaveBeenCalledWith('t1', 'c1');
  });
});
