import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('contract_versions')
@Index(['tenantId', 'contractId'])
export class ContractVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column()
  contractId: string;

  @Column()
  versionNumber: number;

  // References platform file-storage's FileRecord#id — platform is a
  // legal import direction from domain/, so this is a plain FK-by-value,
  // not a TypeORM relation (keeps the two modules' schemas independent).
  @Column()
  fileId: string;

  @Column()
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;
}
