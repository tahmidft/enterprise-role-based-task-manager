import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { Task } from '../entities/task.entity';
import { User } from '../entities/user.entity';
import { AuditService } from '../services/audit.service';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

export interface TaskListQuery {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  assignedTo?: string;
  search?: string;
}

export interface TaskMutationDto extends Partial<Task> {
  dependsOnIds?: string[];
}

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private taskRepo: Repository<Task>,
    private auditService: AuditService,
    @Inject(REQUEST) private request: Request,
  ) {}

  async findAll(
    user: User,
    query: TaskListQuery,
  ): Promise<{ data: Task[]; total: number; page: number; limit: number }> {
    const isViewer = user.role.name === 'viewer';
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));

    const whereBase: Record<string, unknown> = {
      organizationId: user.organizationId,
    };
    if (query.status) whereBase['status'] = query.status;
    if (query.priority) whereBase['priority'] = query.priority;
    if (query.assignedTo) whereBase['assignedToId'] = query.assignedTo;
    if (isViewer) whereBase['assignedToId'] = user.id;

    const where = query.search
      ? [
          { ...whereBase, title: ILike(`%${query.search}%`) },
          { ...whereBase, description: ILike(`%${query.search}%`) },
        ]
      : whereBase;

    const [data, total] = await this.taskRepo.findAndCount({
      where,
      relations: ['assignedTo', 'createdBy', 'dependsOn', 'children'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    await this.auditService.log({
      action: 'task:list',
      resource: 'task',
      user,
      ipAddress: this.request.ip || 'unknown',
      userAgent: this.request.get('user-agent') || 'unknown',
      metadata: { page, limit, filters: query },
    });

    return { data, total, page, limit };
  }

  async findOne(id: string, user: User): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where: { id },
      relations: ['assignedTo', 'createdBy', 'dependsOn', 'children'],
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

  async create(createTaskDto: TaskMutationDto, user: User): Promise<Task> {
    const depTasks = createTaskDto.dependsOnIds?.length
      ? await this.taskRepo.findBy({ id: In(createTaskDto.dependsOnIds) })
      : [];

    const newTask = this.taskRepo.create({
      ...createTaskDto,
      createdById: user.id,
      organizationId: user.organizationId,
      dependsOn: depTasks,
    });

    const result = await this.taskRepo.save(newTask);

    await this.auditService.log({
      action: 'task:create',
      resource: 'task',
      resourceId: result.id,
      user,
      ipAddress: this.request.ip || 'unknown',
      userAgent: this.request.get('user-agent') || 'unknown',
      metadata: { title: createTaskDto.title },
    });

    return result;
  }

  async update(id: string, updateTaskDto: TaskMutationDto, user: User): Promise<Task> {
    const task = await this.findOne(id, user);
    if (updateTaskDto.dependsOnIds) {
      task.dependsOn = await this.taskRepo.findBy({ id: In(updateTaskDto.dependsOnIds) });
    }
    delete updateTaskDto.dependsOnIds;
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
  }
}
