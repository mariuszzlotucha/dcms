import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// One row per tenant — the "default approval workflow" seeded on
// tenant.created (dcms-domain-architecture.md 1.3). MVP v0 is single-stage
// only (stages is stored for forward-compatibility with v1+ multi-stage
// workflows, but nothing branches on it yet).
@Entity('approval_workflows')
@Index(['tenantId'], { unique: true })
export class ApprovalWorkflow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column({ default: 1 })
  stages: number;

  @CreateDateColumn()
  createdAt: Date;
}
