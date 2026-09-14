import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { ContractStatus } from '@contracts/contract.schema';

@Entity('contracts')
@Index(['tenantId', 'status'])
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  // Opaque reference to templates.Template#id — no relation, see
  // shared/contracts/contract.schema.ts for why.
  @Column({ type: 'uuid', nullable: true })
  templateId: string | null;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: 'draft' })
  status: ContractStatus;

  @Column()
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
