import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../entities/task.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private taskRepo: Repository<Task>,
  ) {}

  async findAll(user: User): Promise<Task[]> {
    // Admins and managers see all tasks in their organization
    if (['admin', 'manager'].includes(user.role.name)) {
      return this.taskRepo.find({
        where: { organization: { id: user.organization.id } },
        relations: ['assignedTo', 'createdBy', 'organization'],
      });
    }

    // Employees only see their assigned tasks
    return this.taskRepo.find({
      where: { assignedTo: { id: user.id } },
      relations: ['assignedTo', 'createdBy', 'organization'],
    });
  }

  async findOne(id: string, user: User): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where: { id },
      relations: ['assignedTo', 'createdBy', 'organization'],
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Check access
    if (user.role.name === 'employee' && task.assignedTo.id !== user.id) {
      throw new ForbiddenException('You can only view your assigned tasks');
    }

    if (task.organization.id !== user.organization.id) {
      throw new ForbiddenException('Access denied');
    }

    return task;
  }

  async create(createTaskDto: any, user: User): Promise<Task> {
    const task = this.taskRepo.create({
      ...createTaskDto,
      createdBy: user,
      organization: user.organization,
    });

    return this.taskRepo.save(task);
  }

  async update(id: string, updateTaskDto: any, user: User): Promise<Task> {
    const task = await this.findOne(id, user);

    Object.assign(task, updateTaskDto);

    if (updateTaskDto.status === 'completed' && !task.completedAt) {
      task.completedAt = new Date();
    }

    return this.taskRepo.save(task);
  }

  async remove(id: string, user: User): Promise<void> {
    const task = await this.findOne(id, user);
    await this.taskRepo.remove(task);
  }
}