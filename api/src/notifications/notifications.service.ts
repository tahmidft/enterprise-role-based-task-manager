import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Resend } from 'resend';
import { Task } from '../entities/task.entity';
import { AuditService } from '../services/audit.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private resend: Resend | null = null;
  private fromAddress: string;

  constructor(
    @InjectRepository(Task) private taskRepo: Repository<Task>,
    private configService: ConfigService,
    private auditService: AuditService,
  ) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.fromAddress =
      this.configService.get<string>('RESEND_FROM') ?? 'noreply@example.com';
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn('RESEND_API_KEY not set — emails will be logged only');
    }
  }

  async sendTaskAssigned(
    task: Task,
    assigneeEmail: string,
    assigneeName: string,
  ): Promise<void> {
    const subject = `You have been assigned a task: ${task.title}`;
    const html = `<p>Hi ${assigneeName},</p>
      <p>You have been assigned to <strong>${task.title}</strong>.</p>
      <p>Priority: ${task.priority} | Due: ${task.dueDate ? task.dueDate.toDateString() : 'No due date'}</p>`;

    await this.sendEmail(assigneeEmail, subject, html);
    await this.logNotification('task:assigned', task.id, assigneeEmail);
  }

  async sendTaskCompleted(
    task: Task,
    ownerEmail: string,
    ownerName: string,
  ): Promise<void> {
    const subject = `Task completed: ${task.title}`;
    const html = `<p>Hi ${ownerName},</p>
      <p>The task <strong>${task.title}</strong> has been marked as completed.</p>`;

    await this.sendEmail(ownerEmail, subject, html);
    await this.logNotification('task:completed', task.id, ownerEmail);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async sendDueSoonReminders(): Promise<void> {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const dueSoonTasks = await this.taskRepo.find({
      where: {
        dueDate: Between(now, in24h),
        status: 'pending',
      },
      relations: ['assignedTo'],
    });

    for (const task of dueSoonTasks) {
      if (!task.assignedTo?.email) continue;
      const subject = `Reminder: "${task.title}" is due soon`;
      const html = `<p>Hi ${task.assignedTo.name},</p>
        <p>Your task <strong>${task.title}</strong> is due in less than 24 hours.</p>
        <p>Due: ${task.dueDate?.toDateString()}</p>`;
      await this.sendEmail(task.assignedTo.email, subject, html);
      await this.logNotification('task:due_soon', task.id, task.assignedTo.email);
    }
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    if (!this.resend) {
      this.logger.log(`[Email stub] To: ${to} | Subject: ${subject}`);
      return;
    }
    try {
      await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject,
        html,
      });
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}`, err);
    }
  }

  private async logNotification(
    action: string,
    taskId: string,
    recipient: string,
  ): Promise<void> {
    await this.auditService.log({
      action: `notification:${action}`,
      resource: 'task',
      resourceId: taskId,
      ipAddress: 'system',
      userAgent: 'cron',
      metadata: { recipient },
    });
  }
}
