import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../entities/task.entity';
import { Comment } from '../entities/comment.entity';
import { User } from '../entities/user.entity';
import { AuditService } from '../services/audit.service';
import { TasksGateway } from '../websocket/tasks.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

export interface TaskFilters {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  assignedTo?: string;
  search?: string;
}

export interface TaskWithMeta extends Task {
  latestCommentAt: string | null;
  commentCount: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private taskRepo: Repository<Task>,
    @InjectRepository(Comment)
    private commentRepo: Repository<Comment>,
    private auditService: AuditService,
    private tasksGateway: TasksGateway,
    private notificationsService: NotificationsService,
    @Inject(REQUEST) private request: Request,
  ) {}

  async findAll(
    user: User,
    filters: TaskFilters = {},
  ): Promise<PaginatedResult<TaskWithMeta>> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const offset = (page - 1) * limit;
    const isViewer = user.role.name === 'viewer';

    const query = this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignedTo', 'assignedTo')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .where('task.organizationId = :organizationId', {
        organizationId: user.organizationId,
      });

    if (isViewer) {
      query.andWhere('task.assignedToId = :userId', { userId: user.id });
    }
    if (filters.status) {
      query.andWhere('task.status = :status', { status: filters.status });
    }
    if (filters.priority) {
      query.andWhere('task.priority = :priority', { priority: filters.priority });
    }
    if (filters.assignedTo) {
      query.andWhere('task.assignedToId = :assignedTo', {
        assignedTo: filters.assignedTo,
      });
    }
    if (filters.search) {
      query.andWhere(
        '(LOWER(task.title) LIKE :search OR LOWER(task.description) LIKE :search)',
        { search: `%${filters.search.toLowerCase()}%` },
      );
    }

    const [tasks, total] = await query.skip(offset).take(limit).getManyAndCount();

    // Attach per-task comment stats in one batch query
    const data = await this.attachCommentStats(tasks);

    await this.auditService.log({
      action: 'task:list',
      resource: 'task',
      user,
      ipAddress: this.request.ip || 'unknown',
      userAgent: this.request.get('user-agent') || 'unknown',
    });

    return { data, total, page, limit };
  }

  async findOne(id: string, user: User): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where: { id },
      relations: ['assignedTo', 'createdBy'],
    });

    if (!task) throw new NotFoundException('Task not found');
    if (task.organizationId !== user.organizationId) {
      throw new ForbiddenException('You do not have access to this task');
    }

    await this.auditService.log({
      action: 'task:read',
      resource: 'task',
      resourceId: id,
      user,
      ipAddress: this.request.ip || 'unknown',
      userAgent: this.request.get('user-agent') || 'unknown',
    });

    return task;
  }

  async create(
    createTaskDto: Record<string, unknown>,
    user: User,
  ): Promise<Task> {
    const newTask = this.taskRepo.create({
      ...(createTaskDto as Partial<Task>),
      createdById: user.id,
      organizationId: user.organizationId,
    });

    const saved = await this.taskRepo.save(newTask);
    const result = Array.isArray(saved) ? saved[0] : saved;

    await this.auditService.log({
      action: 'task:create',
      resource: 'task',
      resourceId: result.id,
      user,
      ipAddress: this.request.ip || 'unknown',
      userAgent: this.request.get('user-agent') || 'unknown',
      metadata: { title: createTaskDto['title'] as string },
    });

    this.tasksGateway.emitTaskEvent('task:created', result, user.organizationId);

    if (result.assignedTo?.email) {
      void this.notificationsService.sendTaskAssigned(
        result,
        result.assignedTo.email,
        result.assignedTo.name,
      );
    }

    return result;
  }

  async update(
    id: string,
    updateTaskDto: Record<string, unknown>,
    user: User,
  ): Promise<Task> {
    const task = await this.findOne(id, user);
    const prevAssignedToId = task.assignedToId;
    const prevStatus = task.status;

    Object.assign(task, updateTaskDto);
    const updated = await this.taskRepo.save(task);

    await this.auditService.log({
      action: 'task:update',
      resource: 'task',
      resourceId: id,
      user,
      ipAddress: this.request.ip || 'unknown',
      userAgent: this.request.get('user-agent') || 'unknown',
      metadata: updateTaskDto as Record<string, unknown>,
    });

    const newAssignment =
      updateTaskDto['assignedToId'] !== undefined &&
      updateTaskDto['assignedToId'] !== prevAssignedToId;

    this.tasksGateway.emitTaskEvent(
      newAssignment ? 'task:assigned' : 'task:updated',
      updated,
      user.organizationId,
    );

    const freshTask = await this.taskRepo.findOne({
      where: { id },
      relations: ['assignedTo', 'createdBy'],
    });

    if (freshTask && newAssignment && freshTask.assignedTo?.email) {
      void this.notificationsService.sendTaskAssigned(
        freshTask,
        freshTask.assignedTo.email,
        freshTask.assignedTo.name,
      );
    }

    if (
      freshTask &&
      prevStatus !== 'completed' &&
      freshTask.status === 'completed' &&
      freshTask.createdBy?.email
    ) {
      void this.notificationsService.sendTaskCompleted(
        freshTask,
        freshTask.createdBy.email,
        freshTask.createdBy.name,
      );
    }

    return updated;
  }

  async remove(id: string, user: User): Promise<void> {
    const task = await this.findOne(id, user);
    await this.taskRepo.remove(task);

    await this.auditService.log({
      action: 'task:delete',
      resource: 'task',
      resourceId: id,
      user,
      ipAddress: this.request.ip || 'unknown',
      userAgent: this.request.get('user-agent') || 'unknown',
      metadata: { title: task.title },
    });

    this.tasksGateway.emitTaskEvent(
      'task:deleted',
      { ...task, id } as Task,
      user.organizationId,
    );
  }

  private async attachCommentStats(tasks: Task[]): Promise<TaskWithMeta[]> {
    if (tasks.length === 0) {
      return [];
    }

    const taskIds = tasks.map(t => t.id);

    const stats = await this.commentRepo
      .createQueryBuilder('c')
      .select('c.taskId', 'taskId')
      .addSelect('MAX(c.createdAt)', 'latestCommentAt')
      .addSelect('COUNT(*)', 'commentCount')
      .where('c.taskId IN (:...taskIds)', { taskIds })
      .groupBy('c.taskId')
      .getRawMany<{ taskId: string; latestCommentAt: string | null; commentCount: string }>();

    const statsMap = new Map(stats.map(s => [s.taskId, s]));

    return tasks.map(task => {
      const s = statsMap.get(task.id);
      return Object.assign(task, {
        latestCommentAt: s?.latestCommentAt ?? null,
        commentCount: s ? Number(s.commentCount) : 0,
      }) as TaskWithMeta;
    });
  }
}
