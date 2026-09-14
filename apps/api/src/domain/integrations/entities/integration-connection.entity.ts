import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { IntegrationSyncStatus, IntegrationType } from '@contracts/integrations.schema';

@Entity('integration_connections')
@Index(['tenantId', 'integration'], { unique: true })
export class IntegrationConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column({ type: 'varchar' })
  integration: IntegrationType;

  @Column({ default: false })
  enabled: boolean;

  @Column({ type: 'varchar', nullable: true })
  syncUrl: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  connectedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ type: 'varchar', default: 'idle' })
  lastSyncStatus: IntegrationSyncStatus;

  @Column({ type: 'varchar', nullable: true })
  lastSyncError: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
