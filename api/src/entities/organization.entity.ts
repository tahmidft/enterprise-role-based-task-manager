import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  industry: string;

  @Column({ nullable: true })
  employeeCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany('User', 'organization')
  users: any[];

  @OneToMany('Task', 'organization')
  tasks: any[];
}