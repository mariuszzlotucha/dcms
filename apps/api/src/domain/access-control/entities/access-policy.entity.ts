import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { AccessPermission } from '@contracts/access-control.schema';

// One row per tenant — the "default access policy" seeded on tenant.created
// (dcms-domain-architecture.md 1.5). Used to pre-fill the permission level
// when granting/inviting; it is not retroactively applied to contracts.
@Entity('access_policies')
@Index(['tenantId'], { unique: true })
export class AccessPolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column({ default: 'view' })
  defaultPermission: AccessPermission;

  @CreateDateColumn()
  createdAt: Date;
}
