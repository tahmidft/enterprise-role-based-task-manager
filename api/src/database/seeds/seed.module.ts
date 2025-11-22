import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { SeedController } from './seed.controller';  // Add this
import { Role } from '../../entities/role.entity';
import { Organization } from '../../entities/organization.entity';
import { User } from '../../entities/user.entity';
import { Task } from '../../entities/task.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Organization, User, Task])],
  controllers: [SeedController],  // Add this
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}