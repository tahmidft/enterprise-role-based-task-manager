import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { SecurityAlert } from '../entities/security-alert.entity';
import { SecurityService } from './security.service';
import { SecurityController } from './security.controller';
import { AuditService } from '../services/audit.service';
import { User } from '../entities/user.entity';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, SecurityAlert, User])],
  providers: [SecurityService, AuditService, RolesGuard],
  controllers: [SecurityController],
})
export class SecurityModule {}
