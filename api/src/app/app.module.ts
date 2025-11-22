import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '../auth/auth.module';
import { TasksModule } from '../tasks/tasks.module';
import { SeedModule } from '../database/seeds/seed.module';
import { AuditService } from '../services/audit.service';
import { AuditController } from '../controllers/audit.controller';
import { AuditLog } from '../entities/audit-log.entity';
import { User } from '../entities/user.entity';
import { databaseConfig } from '../config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(databaseConfig),
    TypeOrmModule.forFeature([AuditLog, User]),
    AuthModule,
    TasksModule,
    SeedModule,
  ],
  controllers: [AppController, AuditController],
  providers: [AppService, AuditService],
  exports: [AuditService],
})
export class AppModule {}
