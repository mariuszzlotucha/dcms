import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { ReminderStatus, ReminderType } from '@contracts/notifications-reminders.schema';

@Entity('reminders')
@Index(['tenantId', 'status'])
@Index(['contractId'])
export class Reminder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column()
  contractId: string;

  @Column({ type: 'varchar' })
  reminderType: ReminderType;

  // Set for approval.requested (the approverId) — null otherwise, since
  // the other trigger events carry no resolvable system user (see
  // notifications-reminders.service.ts).
  @Column({ type: 'uuid', nullable: true })
  recipientUserId: string | null;

  // Set only for esignature.sent, whose payload carries the external
  // signer's email directly — the one case with a real outbound address.
  @Column({ type: 'varchar', nullable: true })
  recipientEmail: string | null;

  @Column({ type: 'timestamptz' })
  scheduledFor: Date;

  @Column({ type: 'varchar', default: 'pending' })
  status: ReminderStatus;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
