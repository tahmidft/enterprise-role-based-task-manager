import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditRepo: Repository<AuditLog>,
  ) {}

  async log(data: {
    action: string;
    resource: string;
    resourceId?: string;
    user?: User;
    ipAddress: string;
    userAgent: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const log = this.auditRepo.create({
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId,
      userId: data.user?.id,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      metadata: data.metadata,
    });

    await this.auditRepo.save(log);

    // Also log to console
    console.log('[AUDIT]', {
      timestamp: new Date().toISOString(),
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId,
      userId: data.user?.id,
      userEmail: data.user?.email,
      ip: data.ipAddress,
    });
  }

  async findAll(organizationId: string): Promise<AuditLog[]> {
    return this.auditRepo
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.user', 'user')
      .where('user.organizationId = :organizationId', { organizationId })
      .orderBy('audit.createdAt', 'DESC')
      .limit(100)
      .getMany();
  }
}
