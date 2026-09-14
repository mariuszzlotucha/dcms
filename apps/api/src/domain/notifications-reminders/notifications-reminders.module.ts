import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reminder } from './entities/reminder.entity';
import { NotificationsRemindersController } from './notifications-reminders.controller';
import { NotificationsRemindersListener } from './notifications-reminders.listener';
import { NotificationsRemindersService } from './notifications-reminders.service';

@Module({
  imports: [TypeOrmModule.forFeature([Reminder])],
  controllers: [NotificationsRemindersController],
  providers: [NotificationsRemindersService, NotificationsRemindersListener],
  exports: [NotificationsRemindersService],
})
export class NotificationsRemindersModule {}
