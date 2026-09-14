import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@platform/auth/guards/jwt-auth.guard';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';
import { Reminder } from './entities/reminder.entity';
import { NotificationsRemindersService } from './notifications-reminders.service';

@Controller('contracts/:contractId/reminders')
@UseGuards(JwtAuthGuard)
export class NotificationsRemindersController {
  constructor(
    private readonly notificationsRemindersService: NotificationsRemindersService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get()
  async listReminders(@Param('contractId') contractId: string): Promise<Reminder[]> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.notificationsRemindersService.listReminders(tenantId, contractId);
  }
}
