import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../entities/user.entity';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get(':id/evm')
  @Permissions('tasks:read')
  getEvm(@Param('id') projectId: string, @CurrentUser() user: User) {
    return this.projectsService.getEvm(projectId, user);
  }

  @Get(':id/critical-path')
  @Permissions('tasks:read')
  getCriticalPath(@Param('id') projectId: string, @CurrentUser() user: User) {
    return this.projectsService.getCriticalPath(projectId, user);
  }

  @Get(':id/resource-leveling')
  @Permissions('tasks:read')
  getResourceLeveling(@Param('id') projectId: string, @CurrentUser() user: User) {
    return this.projectsService.getResourceLeveling(projectId, user);
  }
}

