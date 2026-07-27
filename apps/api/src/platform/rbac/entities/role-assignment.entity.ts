import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { RbacRole } from '../rbac.config';

@Entity('role_assignments')
export class RoleAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  tenantId: string;

  @Column({ type: 'enum', enum: ['owner', 'admin', 'member'] })
  role: RbacRole;

  @CreateDateColumn()
  createdAt: Date;
}
