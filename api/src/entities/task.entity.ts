import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { User } from './user.entity';
import { Organization } from './organization.entity';
import { Project } from './project.entity';

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

  @Column({ type: 'timestamptz', nullable: true })
  dueDate?: Date;

  @Column({ type: 'float', default: 0 })
  budgetHours!: number;

  @Column({ type: 'float', default: 0 })
  actualHours!: number;

  @Column({ type: 'float', default: 0 })
  completionPercent!: number;

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

  @ManyToOne(() => Project, project => project.tasks, { nullable: true })
  @JoinColumn({ name: 'projectId' })
  project?: Project;

  @Column({ nullable: true })
  projectId?: string;

  @ManyToOne(() => Task, task => task.children, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parentTaskId' })
  parentTask?: Task;

  @Column({ nullable: true })
  parentTaskId?: string;

  @OneToMany(() => Task, task => task.parentTask)
  children!: Task[];

  @ManyToMany(() => Task)
  @JoinTable({
    name: 'task_dependencies',
    joinColumn: { name: 'taskId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'dependsOnTaskId', referencedColumnName: 'id' },
  })
  dependsOn!: Task[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
