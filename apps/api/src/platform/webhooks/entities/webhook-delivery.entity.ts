import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('webhook_deliveries')
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  subscriptionId: string;

  @Column()
  eventType: string;

  @Column({ type: 'jsonb' })
  payload: unknown;

  @Column({ type: 'int', nullable: true })
  statusCode: number | null;

  @Column()
  attempt: number;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
