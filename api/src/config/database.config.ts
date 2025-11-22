import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Role } from '../entities/role.entity';
import { Organization } from '../entities/organization.entity';
import { User } from '../entities/user.entity';
import { Task } from '../entities/task.entity';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'sqlite',
  database: 'data/recruitment-app.db',
  entities: [Role, Organization, User, Task],
  synchronize: true,
  logging: false,
};