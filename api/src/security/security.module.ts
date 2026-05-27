import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { SecurityService } from './security.service';
import { SecurityController } from './security.controller';
import { AuditService } from '../services/audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [SecurityService, AuditService],
  controllers: [SecurityController],
})
export class SecurityModule {}

