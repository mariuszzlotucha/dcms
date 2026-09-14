import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { ApprovalRequestStatus } from '@contracts/negotiation-approval.schema';

@Entity('approval_requests')
@Index(['tenantId', 'contractId'])
export class ApprovalRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column()
  contractId: string;

  @Column()
  approverId: string;

  @Column({ default: 'pending' })
  status: ApprovalRequestStatus;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @CreateDateColumn()
  requestedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt: Date | null;
}
