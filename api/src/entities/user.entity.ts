import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Role } from './role.entity';
import { Organization } from './organization.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  @Column()
  name!: string;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @ManyToOne(() => Role, role => role.users, { eager: true })
  @JoinColumn({ name: 'roleId' })
  role!: Role;

  @Column()
  roleId!: string;

  @ManyToOne(() => Organization, org => org.users)
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  @Column()
  organizationId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
