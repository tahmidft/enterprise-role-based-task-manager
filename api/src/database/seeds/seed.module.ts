import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { SeedController } from './seed.controller';
import { User } from '../../entities/user.entity';
import { Organization } from '../../entities/organization.entity';
import { Role } from '../../entities/role.entity';
import { Permission } from '../../entities/permission.entity';
import { Task } from '../../entities/task.entity';
import { Project } from '../../entities/project.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Organization, Role, Permission, Task, Project])],
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
