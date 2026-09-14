import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { AccessPermission } from '@contracts/access-control.schema';

// A pending grant for someone who may not have a platform account yet.
// AccessControlListener.handleAuthUserRegistered resolves matching invites
// into real ContractAccessGrant rows once the invitee signs up.
@Entity('collaboration_invites')
@Index(['tenantId', 'invitedEmail'])
export class CollaborationInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column()
  contractId: string;

  @Column()
  invitedEmail: string;

  @Column()
  permission: AccessPermission;

  @Column()
  invitedBy: string;

  @CreateDateColumn()
  invitedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
}
