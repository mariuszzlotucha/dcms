import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  // Nullable: OAuth-only users have no password.
  @Column({ type: 'varchar', nullable: true })
  passwordHash!: string | null;

  // Nullable until the tenants module exists.
  @Column({ type: 'uuid', nullable: true })
  tenantId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
