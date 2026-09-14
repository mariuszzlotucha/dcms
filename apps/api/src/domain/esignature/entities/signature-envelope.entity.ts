import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { EsignatureProviderName, SignatureEnvelopeStatus } from '@contracts/esignature.schema';

@Entity('signature_envelopes')
@Index(['tenantId', 'contractId'])
export class SignatureEnvelope {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  // Opaque reference to contracts.Contract#id — no relation, see
  // shared/contracts/esignature.schema.ts for why.
  @Column()
  contractId: string;

  // Opaque reference to the platform file-storage FileRecord#id that was
  // sent for signature.
  @Column()
  fileId: string;

  @Column()
  provider: EsignatureProviderName;

  // Provider-assigned id, globally unique (not tenant-scoped) — webhook
  // callbacks from DocuSign carry only this, never our tenantId, so it's
  // the only key EsignatureListener can look envelopes up by.
  @Column()
  @Index({ unique: true })
  envelopeId: string;

  @Column()
  signerEmail: string;

  @Column()
  signerName: string;

  @Column({ default: 'sent' })
  status: SignatureEnvelopeStatus;

  @Column({ type: 'text', nullable: true })
  declineReason: string | null;

  @CreateDateColumn()
  requestedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
