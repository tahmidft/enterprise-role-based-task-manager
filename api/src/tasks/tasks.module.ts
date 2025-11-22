import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { Task } from '../entities/task.entity';
import { AuditService } from '../services/audit.service';
import { AuditLog } from '../entities/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Task, AuditLog])],
  controllers: [TasksController],
  providers: [TasksService, AuditService],
})
export class TasksModule {}
