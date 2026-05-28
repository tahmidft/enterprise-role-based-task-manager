import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { TaskListQuery, TaskMutationDto, TasksService } from './tasks.service';
import { User } from '../entities/user.entity';

@Controller('tasks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @Permissions('tasks:read')
  findAll(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('search') search?: string,
    @Query('tree') tree?: string,
  ) {
    const query: TaskListQuery = {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
      priority,
      assignedTo,
      search,
    };
    if (tree === 'true') {
      return this.tasksService.findAllAsTree(user, query);
    }
    return this.tasksService.findAll(user, query);
  }

  @Get(':id')
  @Permissions('tasks:read')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.tasksService.findOne(id, user);
  }

  @Post()
  @Permissions('tasks:create')
  create(@Body() createTaskDto: TaskMutationDto, @CurrentUser() user: User) {
    return this.tasksService.create(createTaskDto, user);
  }

  @Put(':id')
  @Permissions('tasks:update')
  update(
    @Param('id') id: string,
    @Body() updateTaskDto: TaskMutationDto,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.update(id, updateTaskDto, user);
  }

  @Delete(':id')
  @Permissions('tasks:delete')
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.tasksService.remove(id, user);
  }
}
