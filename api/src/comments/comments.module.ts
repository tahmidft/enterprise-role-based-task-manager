import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { Comment } from '../entities/comment.entity';
import { Task } from '../entities/task.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { AuditService } from '../services/audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([Comment, Task, AuditLog])],
  controllers: [CommentsController],
  providers: [CommentsService, AuditService],
})
export class CommentsModule {}
