import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Transient tracking, not a historical record: one row while a contract is
// in negotiation, deleted the moment it leaves — used only to compute the
// duration that feeds the 'negotiation.avgDurationHours' metric.
@Entity('negotiation_timings')
@Index(['tenantId', 'contractId'], { unique: true })
export class NegotiationTiming {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column()
  contractId: string;

  @CreateDateColumn()
  enteredNegotiationAt: Date;
}
