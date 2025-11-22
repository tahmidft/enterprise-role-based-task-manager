import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column()
  status: string; // 'pending', 'in-progress', 'completed'

  @Column()
  priority: string; // 'low', 'medium', 'high'

  @ManyToOne(() => User, (user) => user.tasks)
  assignedTo: User;

  @Column()
  assignedToId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
