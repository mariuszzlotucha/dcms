import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('usage_counters')
@Index(['tenantId', 'metric', 'period'], { unique: true })
export class UsageCounter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column()
  metric: string;

  @Column()
  period: string;

  @Column({ default: 0 })
  count: number;
}
