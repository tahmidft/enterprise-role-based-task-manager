import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Organization } from '../entities/organization.entity';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { Task } from '../entities/task.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { Project } from '../entities/project.entity';

const entities = [User, Organization, Role, Permission, Task, AuditLog, Project];

export const buildDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => {
  const synchronize = configService.get<string>('DB_SYNCHRONIZE') === 'true';
  const logging = configService.get<string>('DB_LOGGING') === 'true';
  const ssl = configService.get<string>('DB_SSL') === 'true';

  return {
    type: 'postgres',
    url: configService.get<string>('DATABASE_URL'),
    entities,
    migrations: ['dist/api/src/database/migrations/*.js'],
    migrationsTableName: 'typeorm_migrations',
    synchronize,
    logging,
    ssl: ssl ? { rejectUnauthorized: false } : false,
  };
};

export const databaseConfigAsync: TypeOrmModuleAsyncOptions = {
  inject: [ConfigService],
  useFactory: buildDatabaseConfig,
};
