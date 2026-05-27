import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../entities/task.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { User } from '../entities/user.entity';

export interface AnalyticsResult {
  totalTasks: number;
  openTasks: number;
  overdueTasks: number;
  completionRate: number;
  tasksByStatus: Record<string, number>;
  tasksByPriority: Record<string, number>;
  tasksByAssignee: { assigneeId: string; assigneeName: string; count: number }[];
  activeUsers: number;
  auditActivityLast30Days: { date: string; count: number }[];
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Task) private taskRepo: Repository<Task>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async getAnalytics(organizationId: string): Promise<AnalyticsResult> {
    const allTasks = await this.taskRepo.find({
      where: { organizationId },
      relations: ['assignedTo'],
    });

    const now = new Date();
    const totalTasks = allTasks.length;
    const openTasks = allTasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length;
    const overdueTasks = allTasks.filter(
      t => t.dueDate && t.dueDate < now && t.status !== 'completed',
    ).length;
    const closedTasks = allTasks.filter(
      t => t.status === 'completed' || t.status === 'cancelled',
    ).length;
    const completionRate = totalTasks > 0 ? closedTasks / totalTasks : 0;

    const tasksByStatus: Record<string, number> = {};
    const tasksByPriority: Record<string, number> = {};
    const assigneeMap = new Map<string, { name: string; count: number }>();

    for (const task of allTasks) {
      tasksByStatus[task.status] = (tasksByStatus[task.status] ?? 0) + 1;
      tasksByPriority[task.priority] = (tasksByPriority[task.priority] ?? 0) + 1;
      if (task.assignedTo) {
        const key = task.assignedTo.id;
        const entry = assigneeMap.get(key) ?? {
          name: task.assignedTo.name,
          count: 0,
        };
        entry.count += 1;
        assigneeMap.set(key, entry);
      }
    }

    const tasksByAssignee = Array.from(assigneeMap.entries()).map(
      ([assigneeId, { name, count }]) => ({
        assigneeId,
        assigneeName: name,
        count,
      }),
    );

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const auditRows = await this.auditRepo
      .createQueryBuilder('audit')
      .leftJoin('audit.user', 'user')
      .where('user.organizationId = :organizationId', { organizationId })
      .andWhere('audit.createdAt >= :since', { since: thirtyDaysAgo })
      .select("TO_CHAR(audit.createdAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .groupBy("TO_CHAR(audit.createdAt, 'YYYY-MM-DD')")
      .orderBy("TO_CHAR(audit.createdAt, 'YYYY-MM-DD')", 'ASC')
      .getRawMany<{ date: string; count: string }>();

    const auditActivityLast30Days = auditRows.map(r => ({
      date: r.date,
      count: Number(r.count),
    }));

    const thirtyDaysAgoForUsers = new Date();
    thirtyDaysAgoForUsers.setDate(thirtyDaysAgoForUsers.getDate() - 30);

    const activeUsers = await this.userRepo
      .createQueryBuilder('user')
      .innerJoin(
        AuditLog,
        'audit',
        'audit.userId = user.id AND audit.createdAt >= :since',
        { since: thirtyDaysAgoForUsers },
      )
      .where('user.organizationId = :organizationId', { organizationId })
      .getCount();

    return {
      totalTasks,
      openTasks,
      overdueTasks,
      completionRate: Math.round(completionRate * 100) / 100,
      tasksByStatus,
      tasksByPriority,
      tasksByAssignee,
      activeUsers,
      auditActivityLast30Days,
    };
  }
}
