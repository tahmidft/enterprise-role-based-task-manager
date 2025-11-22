import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../entities/user.entity';
import { AuditService } from '../services/audit.service';

@Controller('audit-log')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  @Permissions('audit:read')
  async getAuditLogs(@CurrentUser() user: User) {
    return this.auditService.findAll(user.organizationId);
  }
}
