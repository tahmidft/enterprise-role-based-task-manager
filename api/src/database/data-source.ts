import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { Organization } from '../entities/organization.entity';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { Task } from '../entities/task.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { Project } from '../entities/project.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env['DATABASE_URL'],
  entities: [User, Organization, Role, Permission, Task, AuditLog, Project],
  migrations: ['api/src/database/migrations/*.ts'],
  synchronize: false,
  logging: false,
  ssl: process.env['DB_SSL'] === 'true' ? { rejectUnauthorized: false } : false,
});

export default AppDataSource;

