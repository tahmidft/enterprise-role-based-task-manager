import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';
import { Organization } from './organization.entity';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column('text')
  description!: string;

  @Column({ default: 'pending' })
  status!: string;

  @Column({ default: 'medium' })
  priority!: string;

  @Column({ type: 'datetime', nullable: true })
  dueDate?: Date;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'assignedToId' })
  assignedTo?: User;

  @Column({ nullable: true })
  assignedToId?: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'createdById' })
  createdBy?: User;

  @Column({ nullable: true })
  createdById?: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  @Column()
  organizationId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
