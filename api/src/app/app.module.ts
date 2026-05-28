import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '../auth/auth.module';
import { TasksModule } from '../tasks/tasks.module';
import { SeedModule } from '../database/seeds/seed.module';
import { AuditService } from '../services/audit.service';
import { AuditController } from '../controllers/audit.controller';
import { AuditLog } from '../entities/audit-log.entity';
import { User } from '../entities/user.entity';
import { databaseConfigAsync } from '../config/database.config';
import { ProjectsModule } from '../projects/projects.module';
import { SecurityModule } from '../security/security.module';
import { PriorityAgingModule } from '../tasks/priority-aging.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CommentsModule } from '../comments/comments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync(databaseConfigAsync),
    TypeOrmModule.forFeature([AuditLog, User]),
    AuthModule,
    TasksModule,
    SeedModule,
    ProjectsModule,
    SecurityModule,
    PriorityAgingModule,
    AnalyticsModule,
    CommentsModule,
  ],
  controllers: [AppController, AuditController],
  providers: [AppService, AuditService],
  exports: [AuditService],
})
export class AppModule {}
