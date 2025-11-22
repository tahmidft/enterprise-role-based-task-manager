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
  password: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @ManyToOne(() => Role, (role) => role.users)
  role: any; // Changed to any

  @Column()
  roleId: string;

  @ManyToOne(() => Organization)
  organization: any; // Changed to any

  @Column()
  organizationId: string;

  @OneToMany(() => Task, (task) => task.assignedTo)
  tasks: any[]; // Changed to any[]

  @CreateDateColumn()
  createdAt: Date;
}