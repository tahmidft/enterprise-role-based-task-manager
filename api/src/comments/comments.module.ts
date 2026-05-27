import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { Comment } from '../entities/comment.entity';
import { Task } from '../entities/task.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { AuditService } from '../services/audit.service';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comment, Task, AuditLog]),
    WebsocketModule,
  ],
  controllers: [CommentsController],
  providers: [CommentsService, AuditService],
})
export class CommentsModule {}
