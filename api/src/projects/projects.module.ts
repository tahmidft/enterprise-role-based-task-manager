import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../entities/project.entity';
import { Task } from '../entities/task.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { AuditService } from '../services/audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([Project, Task, AuditLog])],
  providers: [ProjectsService, AuditService],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}

