import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../entities/task.entity';
import { User } from '../entities/user.entity';
import { AuditService } from '../services/audit.service';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private taskRepo: Repository<Task>,
    private auditService: AuditService,
    @Inject(REQUEST) private request: Request,
  ) {}

  async findAll(user: User): Promise<Task[]> {
    const isViewer = user.role.name === 'viewer';

    const query = this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignedTo', 'assignedTo')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .where('task.organizationId = :organizationId', { organizationId: user.organizationId });

    if (isViewer) {
      query.andWhere('task.assignedToId = :userId', { userId: user.id });
    }

    await this.auditService.log({
      action: 'task:list',
      resource: 'task',
      user,
      ipAddress: this.request.ip || 'unknown',
      userAgent: this.request.get('user-agent') || 'unknown',
    });

    return query.getMany();
  }

  async findOne(id: string, user: User): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where: { id },
      relations: ['assignedTo', 'createdBy'],
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

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

  async create(createTaskDto: any, user: User): Promise<Task> {
    const newTask = this.taskRepo.create({
      ...createTaskDto,
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
      metadata: { title: createTaskDto.title },
    });

    return result;
  }

  async update(id: string, updateTaskDto: any, user: User): Promise<Task> {
    const task = await this.findOne(id, user);
    Object.assign(task, updateTaskDto);
    const updated = await this.taskRepo.save(task);

    await this.auditService.log({
      action: 'task:update',
      resource: 'task',
      resourceId: id,
      user,
      ipAddress: this.request.ip || 'unknown',
      userAgent: this.request.get('user-agent') || 'unknown',
      metadata: updateTaskDto,
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
