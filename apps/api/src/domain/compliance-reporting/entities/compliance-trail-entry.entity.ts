import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('compliance_trail_entries')
@Index(['tenantId', 'contractId'])
export class ComplianceTrailEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column()
  contractId: string;

  @Column()
  eventName: string;

  @Column({ type: 'jsonb' })
  payload: unknown;

  @Column({ type: 'timestamptz' })
  recordedAt: Date;
}
