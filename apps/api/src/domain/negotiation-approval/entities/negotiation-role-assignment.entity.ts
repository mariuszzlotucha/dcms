import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { NegotiationRole } from '@contracts/negotiation-approval.schema';

@Entity('negotiation_role_assignments')
@Index(['tenantId', 'contractId', 'userId'], { unique: true })
export class NegotiationRoleAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  // Opaque reference to contracts.Contract#id — no relation, see
  // shared/contracts/negotiation-approval.schema.ts for why.
  @Column()
  contractId: string;

  @Column()
  userId: string;

  @Column()
  role: NegotiationRole;

  @CreateDateColumn()
  assignedAt: Date;
}
