import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../entities/user.entity';
import { SecurityService } from './security.service';

@Controller('security')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get('alerts')
  @Permissions('audit:read')
  getAlerts(@CurrentUser() user: User) {
    return this.securityService.getAlerts(user);
  }
}

