import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('webhook_subscriptions')
export class WebhookSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column()
  url: string;

  @Column()
  secret: string;

  @Column('text', { array: true })
  eventTypes: string[];

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;
}
