import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { Organization } from '../entities/organization.entity';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { Task } from '../entities/task.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { Comment } from '../entities/comment.entity';

export function buildDatabaseConfig(
  configService: ConfigService,
): TypeOrmModuleOptions {
  const url = configService.getOrThrow<string>('DATABASE_URL');
  const ssl = configService.get<string>('DB_SSL') === 'true';
  const synchronize =
    configService.get<string>('DB_SYNCHRONIZE') === 'true';
  const logging = configService.get<string>('DB_LOGGING') === 'true';

  return {
    type: 'postgres',
    url,
    ssl: ssl ? { rejectUnauthorized: false } : false,
    entities: [
      User,
      Organization,
      Role,
      Permission,
      Task,
      AuditLog,
      RefreshToken,
      Comment,
    ],
    synchronize,
    logging,
  };
}
