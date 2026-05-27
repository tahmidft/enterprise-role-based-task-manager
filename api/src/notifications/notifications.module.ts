import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { Task } from '../entities/task.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { User } from '../entities/user.entity';
import { AuditService } from '../services/audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([Task, AuditLog, User])],
  providers: [NotificationsService, AuditService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
