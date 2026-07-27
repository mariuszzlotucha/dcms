import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('file_records')
export class FileRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column({ unique: true })
  storageKey: string;

  @Column()
  originalFilename: string;

  @Column()
  mimeType: string;

  @Column()
  sizeBytes: number;

  @Column()
  uploadedBy: string;

  @CreateDateColumn()
  createdAt: Date;
}
