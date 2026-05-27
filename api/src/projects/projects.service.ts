import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { Task } from '../entities/task.entity';
import { User } from '../entities/user.entity';
import { AuditService } from '../services/audit.service';
import { computeCriticalPath, computeEvmFromTasks } from './project-math';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    private readonly auditService: AuditService,
    @Inject(REQUEST) private readonly request: Request,
  ) {}

  async getEvm(projectId: string, user: User) {
    const project = await this.ensureProjectAccess(projectId, user);
    const tasks = await this.taskRepo.find({
      where: { projectId: project.id, organizationId: user.organizationId },
      relations: ['children'],
    });

    const { pv, ev, ac } = computeEvmFromTasks(tasks);
    const cpi = ac > 0 ? ev / ac : 1;
    const spi = pv > 0 ? ev / pv : 1;
    const eac = cpi > 0 ? ac + (pv - ev) / cpi : pv;

    await this.auditService.log({
      action: 'project:evm:read',
      resource: 'project',
      resourceId: projectId,
      user,
      ipAddress: this.request.ip || 'unknown',
      userAgent: this.request.get('user-agent') || 'unknown',
      metadata: { pv, ev, ac, spi, cpi, eac },
    });

    return {
      projectId,
      projectName: project.name,
      pv,
      ev,
      ac,
      spi,
      cpi,
      eac,
    };
  }

  async getCriticalPath(projectId: string, user: User) {
    await this.ensureProjectAccess(projectId, user);
    const tasks = await this.taskRepo.find({
      where: { projectId, organizationId: user.organizationId },
      relations: ['dependsOn'],
    });

    const result = computeCriticalPath(tasks);

    await this.auditService.log({
      action: 'project:critical-path:read',
      resource: 'project',
      resourceId: projectId,
      user,
      ipAddress: this.request.ip || 'unknown',
      userAgent: this.request.get('user-agent') || 'unknown',
      metadata: { criticalTasks: result.criticalTaskIds.length },
    });

    return result;
  }

  async getResourceLeveling(projectId: string, user: User) {
    await this.ensureProjectAccess(projectId, user);
    const tasks = await this.taskRepo.find({
      where: { projectId, organizationId: user.organizationId },
      relations: ['dependsOn', 'assignedTo'],
    });
    const cpm = computeCriticalPath(tasks);
    const byId = new Map(tasks.map(t => [t.id, t]));

    const criticalBehind = cpm.nodes
      .filter(n => n.float <= 0.000001)
      .map(n => byId.get(n.taskId))
      .filter((t): t is Task => Boolean(t))
      .filter(t => t.status !== 'completed' && (t.completionPercent ?? 0) < 60);

    const criticalAssignees = new Set(criticalBehind.map(t => t.assignedToId).filter(Boolean));
    const suggestions = cpm.nodes
      .filter(n => n.float > 2)
      .map(n => byId.get(n.taskId))
      .filter((t): t is Task => Boolean(t))
      .filter(t => Boolean(t.assignedToId) && criticalAssignees.has(t.assignedToId))
      .map(task => ({
        taskId: task.id,
        taskTitle: task.title,
        assigneeId: task.assignedToId,
        suggestion:
          'Assignee is on behind-schedule critical work; consider rebalancing this non-critical task.',
      }));

    await this.auditService.log({
      action: 'project:resource-leveling:read',
      resource: 'project',
      resourceId: projectId,
      user,
      ipAddress: this.request.ip || 'unknown',
      userAgent: this.request.get('user-agent') || 'unknown',
      metadata: { suggestions: suggestions.length },
    });

    return { suggestions };
  }

  private async ensureProjectAccess(projectId: string, user: User): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.organizationId !== user.organizationId) {
      throw new ForbiddenException('You do not have access to this project');
    }
    return project;
  }

}

