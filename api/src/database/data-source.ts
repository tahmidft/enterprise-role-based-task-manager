import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { Organization } from '../entities/organization.entity';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { Task } from '../entities/task.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { Project } from '../entities/project.entity';
import { Comment } from '../entities/comment.entity';
import { SecurityAlert } from '../entities/security-alert.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env['DB_HOST'] ?? 'localhost',
  port: Number(process.env['DB_PORT'] ?? '5432'),
  username: process.env['DB_USER'] ?? 'postgres',
  password: process.env['DB_PASSWORD'] ?? 'postgres',
  database: process.env['DB_NAME'] ?? 'task_manager',
  entities: [User, Organization, Role, Permission, Task, AuditLog, Project, Comment, SecurityAlert],
  migrations: ['api/src/database/migrations/*.ts'],
  synchronize: false,
  logging: false,
  ssl: process.env['DB_SSL'] === 'true' ? { rejectUnauthorized: false } : false,
});

export default AppDataSource;

