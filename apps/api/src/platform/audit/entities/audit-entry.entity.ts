import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_entries')
export class AuditEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eventName: string;

  @Column({ nullable: true })
  actorId: string | null;

  @Column({ nullable: true })
  tenantId: string | null;

  @Column({ type: 'jsonb' })
  payload: unknown;

  @Column({ type: 'timestamptz' })
  timestamp: Date;
}
