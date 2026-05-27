import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../entities/user.entity';
import { CommentsService } from './comments.service';

@Controller('tasks/:taskId/comments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Get()
  @Permissions('tasks:read')
  findAll(
    @Param('taskId') taskId: string,
    @CurrentUser() user: User,
  ) {
    return this.commentsService.findByTask(taskId, user);
  }

  @Post()
  @Permissions('tasks:update')
  create(
    @Param('taskId') taskId: string,
    @Body('content') content: string,
    @CurrentUser() user: User,
  ) {
    return this.commentsService.create(taskId, content, user);
  }
}
