import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { ComplianceReportFormat } from '@contracts/compliance-reporting.schema';

@Entity('compliance_reports')
@Index(['tenantId'])
export class ComplianceReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  // null = a tenant-wide report spanning every contract's trail.
  @Column({ type: 'uuid', nullable: true })
  contractId: string | null;

  @Column()
  generatedBy: string;

  // A snapshot of ComplianceTrailEntry rows at generation time (mirrors
  // AnalyticsReport#metrics) — a report is a point-in-time export, not a
  // live view, so later events for the same contract never retroactively
  // change an already-generated report.
  @Column({ type: 'jsonb' })
  entries: unknown[];

  @CreateDateColumn()
  generatedAt: Date;

  @Column({ type: 'varchar', nullable: true })
  exportedFormat: ComplianceReportFormat | null;

  @Column({ type: 'timestamptz', nullable: true })
  exportedAt: Date | null;
}
