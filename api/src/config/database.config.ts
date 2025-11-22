import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Organization } from '../entities/organization.entity';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { Task } from '../entities/task.entity';
import { AuditLog } from '../entities/audit-log.entity';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'better-sqlite3',
  database: 'taskmanagement.db',
  entities: [User, Organization, Role, Permission, Task, AuditLog],
  synchronize: true,
  logging: false,
};
