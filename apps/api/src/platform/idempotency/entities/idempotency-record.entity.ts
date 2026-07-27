import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('idempotency_records')
export class IdempotencyRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  idempotencyKey: string;

  @Column()
  requestPath: string;

  @Column()
  responseStatus: number;

  @Column({ type: 'jsonb' })
  responseBody: unknown;

  @CreateDateColumn()
  createdAt: Date;
}
