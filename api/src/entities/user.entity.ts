import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn } from 'typeorm';
import { Role } from './role.entity';
import { Organization } from './organization.entity';
import { Task } from './task.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string; // Will be hashed with bcrypt

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @ManyToOne(() => Role, (role) => role.users)
  role: Role;

  @Column()
  roleId: string;

  @ManyToOne(() => Organization)
  organization: Organization;

  @Column()
  organizationId: string;

  @OneToMany(() => Task, (task) => task.assignedTo)
  tasks: Task[];

  @CreateDateColumn()
  createdAt: Date;
}
