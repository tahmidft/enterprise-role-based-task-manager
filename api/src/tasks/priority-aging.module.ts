import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from '../entities/task.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { PriorityAgingService } from './priority-aging.service';
import { AuditService } from '../services/audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([Task, AuditLog])],
  providers: [PriorityAgingService, AuditService],
})
export class PriorityAgingModule {}

