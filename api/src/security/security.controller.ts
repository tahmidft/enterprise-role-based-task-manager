import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../entities/user.entity';
import { SecurityService } from './security.service';

@Controller('security')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner')
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get('alerts')
  getAlerts(@CurrentUser() user: User, @Req() req: Request) {
    return this.securityService.getAlerts(
      user,
      req.ip || 'unknown',
      req.get('user-agent') || 'unknown',
    );
  }

  @Patch('alerts/:id/reviewed')
  markReviewed(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    return this.securityService.markReviewed(
      id,
      user,
      req.ip || 'unknown',
      req.get('user-agent') || 'unknown',
    );
  }
}
