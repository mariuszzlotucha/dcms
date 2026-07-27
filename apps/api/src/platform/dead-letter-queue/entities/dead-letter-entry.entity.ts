import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('dead_letter_entries')
export class DeadLetterEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  originalEvent: string;

  @Column({ type: 'jsonb' })
  payload: unknown;

  @Column()
  failureReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  retriedAt: Date | null;
}
