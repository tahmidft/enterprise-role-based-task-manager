import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { User } from './user.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string; // 'admin', 'manager', 'employee'

  @Column('simple-json')
  permissions: string[]; // ['tasks:create', 'tasks:read', etc.]

  @OneToMany(() => User, (user) => user.role)
  users: User[];
}
