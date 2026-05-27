import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { User } from '../entities/user.entity';
import { AuditService } from '../services/audit.service';

type Alert = {
  userId: string;
  userEmail?: string;
  riskScore: number;
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  reasons: string[];
};

@Injectable()
export class SecurityService {
  constructor(
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    private readonly auditService: AuditService,
    @Inject(REQUEST) private readonly request: Request,
  ) {}

  async getAlerts(user: User): Promise<{ alerts: Alert[] }> {
    const logs = await this.auditRepo
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.user', 'user')
      .where('user.organizationId = :organizationId', { organizationId: user.organizationId })
      .orderBy('audit.createdAt', 'DESC')
      .limit(1000)
      .getMany();

    const grouped = new Map<string, AuditLog[]>();
    for (const log of logs) {
      if (!log.userId) continue;
      grouped.set(log.userId, [...(grouped.get(log.userId) ?? []), log]);
    }

    const alerts: Alert[] = [];
    for (const [userId, userLogs] of grouped.entries()) {
      const scoreReasons = this.scoreLogs(userLogs);
      if (scoreReasons.score > 70) {
        alerts.push({
          userId,
          userEmail: userLogs[0]?.user?.email,
          riskScore: scoreReasons.score,
          level: 'HIGH',
          reasons: scoreReasons.reasons,
        });
      }
    }

    await this.auditService.log({
      action: 'security:alerts:read',
      resource: 'security',
      user,
      ipAddress: this.request.ip || 'unknown',
      userAgent: this.request.get('user-agent') || 'unknown',
      metadata: { alertCount: alerts.length },
    });

    return { alerts };
  }

  private scoreLogs(logs: AuditLog[]) {
    let score = 0;
    const reasons: string[] = [];

    const offHours = logs.some(log => {
      const hour = new Date(log.createdAt).getHours();
      return hour < 7 || hour > 20;
    });
    if (offHours) {
      score += 30;
      reasons.push('Off-hours access detected');
    }

    const deleteLogs = logs.filter(log => log.action.includes('delete'));
    deleteLogs.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    let bulkDelete = false;
    for (let i = 0; i < deleteLogs.length; i++) {
      const start = +new Date(deleteLogs[i].createdAt);
      const windowCount = deleteLogs.filter(l => +new Date(l.createdAt) <= start + 5 * 60 * 1000 && +new Date(l.createdAt) >= start).length;
      if (windowCount >= 3) {
        bulkDelete = true;
        break;
      }
    }
    if (bulkDelete) {
      score += 50;
      reasons.push('Bulk deletes in 5-minute window');
    }

    const privilegeEscalation = logs.some(log =>
      log.action.includes('permission_denied') ||
      log.action.includes('forbidden') ||
      JSON.stringify(log.metadata ?? {}).toLowerCase().includes('privilege'),
    );
    if (privilegeEscalation) {
      score += 40;
      reasons.push('Privilege escalation attempts');
    }

    const ips = new Set(logs.map(log => log.ipAddress).filter(Boolean));
    if (ips.size > 1) {
      score += 25;
      reasons.push('Unusual IP changes');
    }

    return { score, reasons };
  }
}

