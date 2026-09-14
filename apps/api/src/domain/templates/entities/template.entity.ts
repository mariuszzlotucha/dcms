import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { TemplateCategory, TemplateField, TemplateStatus } from '@contracts/template.schema';

@Entity('templates')
@Index(['tenantId', 'status'])
export class Template {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column()
  category: TemplateCategory;

  @Column({ default: 'draft' })
  status: TemplateStatus;

  // Locked until unlocked for the tenant via the `premium_templates`
  // feature flag (see TemplatesListener.handleFeatureFlagToggled).
  @Column({ default: false })
  isPremium: boolean;

  @Column({ type: 'jsonb', default: [] })
  fields: TemplateField[];

  @Column()
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
