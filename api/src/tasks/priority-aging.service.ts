import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../entities/task.entity';
import { AuditService } from '../services/audit.service';

@Injectable()
export class PriorityAgingService {
  constructor(
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    private readonly auditService: AuditService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async runNightlyEscalation() {
    const lowToMediumDays = Number(process.env['LOW_TO_MEDIUM_DAYS'] ?? 5);
    const mediumToHighDays = Number(process.env['MEDIUM_TO_HIGH_DAYS'] ?? 3);
    const now = new Date();

    const tasks = await this.taskRepo.find({ where: { status: 'pending' } });
    for (const task of tasks) {
      const ageDays = (now.getTime() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      const oldPriority = task.priority;
      let newPriority = oldPriority;

      if (oldPriority === 'low' && ageDays >= lowToMediumDays) {
        newPriority = 'medium';
      } else if (
        oldPriority === 'medium' &&
        ageDays >= lowToMediumDays + mediumToHighDays
      ) {
        newPriority = 'high';
      }

      if (newPriority !== oldPriority) {
        task.priority = newPriority;
        await this.taskRepo.save(task);
        await this.auditService.log({
          action: 'task:priority-escalated',
          resource: 'task',
          resourceId: task.id,
          ipAddress: 'system',
          userAgent: 'priority-aging-scheduler',
          metadata: { oldPriority, newPriority, ageDays },
        });
      }
    }
  }
}

