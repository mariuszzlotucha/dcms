import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column()
  stripeCustomerId: string;

  @Column()
  stripeSubscriptionId: string;

  @Column()
  plan: string;

  @Column()
  status: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
