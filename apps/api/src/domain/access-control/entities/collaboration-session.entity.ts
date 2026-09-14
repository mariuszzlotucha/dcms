import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Presence marker only — "who has this contract open right now." A single
// row per join; there is no companion "session ended" event in the
// architecture doc, so there's nothing to close it out with here.
@Entity('collaboration_sessions')
@Index(['tenantId', 'contractId'])
export class CollaborationSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column()
  contractId: string;

  @Column()
  userId: string;

  @CreateDateColumn()
  startedAt: Date;
}
