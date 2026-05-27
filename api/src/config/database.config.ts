import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { Organization } from '../entities/organization.entity';
import { Permission } from '../entities/permission.entity';
import { Role } from '../entities/role.entity';
import { Task } from '../entities/task.entity';
import { User } from '../entities/user.entity';

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

export function createTypeOrmOptions(configService: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    url: configService.getOrThrow<string>('DATABASE_URL'),
    entities: [User, Organization, Role, Permission, Task, AuditLog],
    synchronize: parseBoolean(configService.get<string>('DB_SYNCHRONIZE'), false),
    logging: parseBoolean(configService.get<string>('DB_LOGGING'), false),
    ssl: parseBoolean(configService.get<string>('DB_SSL'), true)
      ? { rejectUnauthorized: false }
      : undefined,
  };
}

export const databaseConfigAsync: TypeOrmModuleAsyncOptions = {
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => createTypeOrmOptions(configService),
};
