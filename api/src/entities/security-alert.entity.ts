import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Organization } from './organization.entity';

@Entity('security_alerts')
export class SecurityAlert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ nullable: true })
  userEmail?: string;

  @Column('int')
  riskScore!: number;

  @Column({ default: 'HIGH' })
  level!: 'HIGH' | 'MEDIUM' | 'LOW';

  @Column('jsonb')
  reasons!: string[];

  @Column({ default: false })
  reviewed!: boolean;

  @Column()
  organizationId!: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  @CreateDateColumn()
  createdAt!: Date;
}
