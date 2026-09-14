import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { AccessPermission } from '@contracts/access-control.schema';

@Entity('contract_access_grants')
@Index(['tenantId', 'contractId', 'userId'], { unique: true })
export class ContractAccessGrant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  // Opaque reference to contracts.Contract#id — no relation, see
  // shared/contracts/access-control.schema.ts for why.
  @Column()
  contractId: string;

  @Column()
  userId: string;

  @Column()
  permission: AccessPermission;

  @Column()
  grantedBy: string;

  @CreateDateColumn()
  grantedAt: Date;
}
