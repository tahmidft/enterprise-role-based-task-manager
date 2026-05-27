import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { Task } from '../entities/task.entity';
import { Comment } from '../entities/comment.entity';
import { AuditService } from '../services/audit.service';
import { AuditLog } from '../entities/audit-log.entity';
import { WebsocketModule } from '../websocket/websocket.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, Comment, AuditLog]),
    WebsocketModule,
    NotificationsModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, AuditService],
})
export class TasksModule {}
