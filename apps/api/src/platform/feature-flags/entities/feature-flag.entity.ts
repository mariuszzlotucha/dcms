import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('feature_flags')
@Index(['tenantId', 'flagKey'], { unique: true })
export class FeatureFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column()
  flagKey: string;

  @Column()
  enabled: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}
