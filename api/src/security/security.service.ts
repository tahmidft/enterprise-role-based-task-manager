import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { SecurityAlert } from '../entities/security-alert.entity';
import { User } from '../entities/user.entity';
import { AuditService } from '../services/audit.service';

const SESSION_WINDOW_MS = 30 * 60 * 1000;

@Injectable()
export class SecurityService {
  constructor(
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(SecurityAlert) private readonly alertRepo: Repository<SecurityAlert>,
    private readonly auditService: AuditService,
  ) {}

  async getAlerts(user: User, ipAddress: string, userAgent: string) {
    if (user.role.name !== 'owner') {
      throw new ForbiddenException('Only owners can view security alerts');
    }

    await this.detectAndPersistAlerts(user.organizationId);

    const alerts = await this.alertRepo.find({
      where: { organizationId: user.organizationId },
      order: { createdAt: 'DESC' },
      take: 100,
    });

    await this.auditService.log({
      action: 'security:alerts:read',
      resource: 'security',
      user,
      ipAddress,
      userAgent,
      metadata: { alertCount: alerts.length },
    });

    return {
      alerts: alerts.map(a => ({
        id: a.id,
        userId: a.userId,
        userEmail: a.userEmail,
        riskScore: a.riskScore,
        level: a.level,
        reasons: a.reasons,
        reviewed: a.reviewed,
        createdAt: a.createdAt,
      })),
      unreadCount: alerts.filter(a => !a.reviewed && a.level === 'HIGH').length,
    };
  }

  async markReviewed(alertId: string, user: User, ipAddress: string, userAgent: string) {
    if (user.role.name !== 'owner') {
      throw new ForbiddenException('Only owners can review security alerts');
    }

    const alert = await this.alertRepo.findOne({
      where: { id: alertId, organizationId: user.organizationId },
    });
    if (!alert) throw new NotFoundException('Alert not found');

    alert.reviewed = true;
    await this.alertRepo.save(alert);

    await this.auditService.log({
      action: 'security:alert:reviewed',
      resource: 'security',
      resourceId: alertId,
      user,
      ipAddress,
      userAgent,
    });

    return { id: alert.id, reviewed: true };
  }

  private async detectAndPersistAlerts(organizationId: string): Promise<void> {
    const logs = await this.auditRepo
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.user', 'user')
      .where('user.organizationId = :organizationId', { organizationId })
      .orderBy('audit.createdAt', 'ASC')
      .limit(5000)
      .getMany();

    const byUser = new Map<string, AuditLog[]>();
    for (const log of logs) {
      if (!log.userId) continue;
      byUser.set(log.userId, [...(byUser.get(log.userId) ?? []), log]);
    }

    for (const [userId, userLogs] of byUser.entries()) {
      const sessions = this.splitSessions(userLogs);
      for (const session of sessions) {
        const { score, reasons } = this.scoreSession(session);
        if (score < 70) continue;

        const sessionStart = session[0].createdAt;
        const sessionEnd = session[session.length - 1].createdAt;
        const existing = await this.alertRepo
          .createQueryBuilder('alert')
          .where('alert.userId = :userId', { userId })
          .andWhere('alert.organizationId = :organizationId', { organizationId })
          .andWhere('alert.createdAt BETWEEN :start AND :end', {
            start: sessionStart,
            end: sessionEnd,
          })
          .getOne();
        if (existing) continue;

        await this.alertRepo.save(
          this.alertRepo.create({
            userId,
            userEmail: session[0].user?.email,
            riskScore: score,
            level: 'HIGH',
            reasons,
            reviewed: false,
            organizationId,
            createdAt: sessionStart,
          }),
        );
      }
    }
  }

  private splitSessions(logs: AuditLog[]): AuditLog[][] {
    if (!logs.length) return [];
    const sessions: AuditLog[][] = [];
    let current: AuditLog[] = [logs[0]];

    for (let i = 1; i < logs.length; i++) {
      const gap = +new Date(logs[i].createdAt) - +new Date(logs[i - 1].createdAt);
      if (gap > SESSION_WINDOW_MS) {
        sessions.push(current);
        current = [logs[i]];
      } else {
        current.push(logs[i]);
      }
    }
    sessions.push(current);
    return sessions;
  }

  private scoreSession(logs: AuditLog[]) {
    let score = 0;
    const reasons: string[] = [];

    const offHours = logs.some(log => {
      const hour = new Date(log.createdAt).getHours();
      return hour < 7 || hour >= 22;
    });
    if (offHours) {
      score += 30;
      reasons.push('Off-hours access (before 7am or after 10pm)');
    }

    const deletes = logs
      .filter(log => log.action.toLowerCase().includes('delete'))
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    let bulkDelete = false;
    for (let i = 0; i < deletes.length; i++) {
      const start = +new Date(deletes[i].createdAt);
      const count = deletes.filter(
        l => +new Date(l.createdAt) >= start && +new Date(l.createdAt) <= start + 5 * 60 * 1000,
      ).length;
      if (count >= 5) {
        bulkDelete = true;
        break;
      }
    }
    if (bulkDelete) {
      score += 50;
      reasons.push('5+ DELETE actions within 5 minutes');
    }

    const privilegeAttempts = logs.filter(
      log =>
        log.action.includes('permission_denied') ||
        log.action.includes('forbidden') ||
        log.action.includes('403'),
    );
    if (privilegeAttempts.length >= 3) {
      score += 40;
      reasons.push('Repeated 403 / privilege escalation attempts');
    }

    const ips = new Set(logs.map(l => l.ipAddress).filter(Boolean));
    if (ips.size > 1) {
      score += 25;
      reasons.push('IP address change within session');
    }

    return { score, reasons };
  }
}
