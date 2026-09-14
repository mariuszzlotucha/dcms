import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// A projection, not a source of truth (dcms-domain-architecture.md 1.7:
// "Does NOT store raw source data — reads from event projections"). Each
// row is one named counter/gauge per tenant, upserted as events arrive.
@Entity('tenant_metrics')
@Index(['tenantId', 'metric'], { unique: true })
export class TenantMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column()
  metric: string;

  @Column({ type: 'double precision', default: 0 })
  value: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
