import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from '../entities/comment.entity';
import { Task } from '../entities/task.entity';
import { User } from '../entities/user.entity';
import { AuditService } from '../services/audit.service';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment) private commentRepo: Repository<Comment>,
    @InjectRepository(Task) private taskRepo: Repository<Task>,
    private auditService: AuditService,
    @Inject(REQUEST) private request: Request,
  ) {}

  async findByTask(taskId: string, user: User): Promise<Comment[]> {
    await this.validateTaskAccess(taskId, user);

    return this.commentRepo.find({
      where: { taskId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }

  async create(
    taskId: string,
    content: string,
    user: User,
  ): Promise<Comment> {
    await this.validateTaskAccess(taskId, user);

    const comment = this.commentRepo.create({
      content,
      taskId,
      userId: user.id,
    });
    const saved = await this.commentRepo.save(comment);

    await this.auditService.log({
      action: 'comment:create',
      resource: 'task',
      resourceId: taskId,
      user,
      ipAddress: this.request.ip || 'unknown',
      userAgent: this.request.get('user-agent') || 'unknown',
      metadata: { commentId: saved.id },
    });

    const result = await this.commentRepo.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });
    return result!;
  }

  private async validateTaskAccess(taskId: string, user: User): Promise<Task> {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.organizationId !== user.organizationId) {
      throw new ForbiddenException('You do not have access to this task');
    }
    return task;
  }
}
