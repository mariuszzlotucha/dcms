import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { AnalyticsReportTier } from '@contracts/analytics-insights.schema';

@Entity('analytics_reports')
@Index(['tenantId'])
export class AnalyticsReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column()
  generatedBy: string;

  @Column()
  tier: AnalyticsReportTier;

  // A snapshot of TenantMetric rows at generation time — the report is a
  // point-in-time export, not a live view.
  @Column({ type: 'jsonb' })
  metrics: Record<string, number>;

  @CreateDateColumn()
  generatedAt: Date;
}
