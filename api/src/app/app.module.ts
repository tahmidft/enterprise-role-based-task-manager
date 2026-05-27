import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '../auth/auth.module';
import { TasksModule } from '../tasks/tasks.module';
import { SeedModule } from '../database/seeds/seed.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CommentsModule } from '../comments/comments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditService } from '../services/audit.service';
import { AuditController } from '../controllers/audit.controller';
import { AuditLog } from '../entities/audit-log.entity';
import { User } from '../entities/user.entity';
import { buildDatabaseConfig } from '../config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildDatabaseConfig,
    }),
    TypeOrmModule.forFeature([AuditLog, User]),
    AuthModule,
    TasksModule,
    SeedModule,
    AnalyticsModule,
    CommentsModule,
    NotificationsModule,
  ],
  controllers: [AppController, AuditController],
  providers: [AppService, AuditService],
  exports: [AuditService],
})
export class AppModule {}
