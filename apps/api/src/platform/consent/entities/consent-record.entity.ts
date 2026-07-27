import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('consent_records')
export class ConsentRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  tenantId: string;

  @Column()
  consentType: string;

  @Column()
  version: string;

  @Column({ type: 'timestamptz', nullable: true })
  grantedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;
}
