import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Organization } from '../../entities/organization.entity';
import { Role } from '../../entities/role.entity';
import { Permission } from '../../entities/permission.entity';
import { Task } from '../../entities/task.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SeedService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Organization) private orgRepo: Repository<Organization>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(Permission) private permRepo: Repository<Permission>,
    @InjectRepository(Task) private taskRepo: Repository<Task>,
  ) {}

  async seed() {
    // Clear existing data using clear() instead of delete({})
    await this.taskRepo.clear();
    await this.userRepo.clear();
    await this.roleRepo.clear();
    await this.permRepo.clear();
    await this.orgRepo.clear();

    // Create permissions
    const taskCreatePerm = this.permRepo.create({ name: 'tasks:create', description: 'Create tasks' });
    const taskReadPerm = this.permRepo.create({ name: 'tasks:read', description: 'Read tasks' });
    const taskUpdatePerm = this.permRepo.create({ name: 'tasks:update', description: 'Update tasks' });
    const taskDeletePerm = this.permRepo.create({ name: 'tasks:delete', description: 'Delete tasks' });
    const userCreatePerm = this.permRepo.create({ name: 'users:create', description: 'Create users' });
    const userReadPerm = this.permRepo.create({ name: 'users:read', description: 'Read users' });
    const userUpdatePerm = this.permRepo.create({ name: 'users:update', description: 'Update users' });
    const userDeletePerm = this.permRepo.create({ name: 'users:delete', description: 'Delete users' });
    const auditReadPerm = this.permRepo.create({ name: 'audit:read', description: 'Read audit logs' });

    await this.permRepo.save([
      taskCreatePerm, taskReadPerm, taskUpdatePerm, taskDeletePerm,
      userCreatePerm, userReadPerm, userUpdatePerm, userDeletePerm,
      auditReadPerm
    ]);

    // Create roles with permissions
    const ownerRole = this.roleRepo.create({
      name: 'owner',
      description: 'Organization owner with full access',
    });
    ownerRole.permissions = [
      taskCreatePerm, taskReadPerm, taskUpdatePerm, taskDeletePerm,
      userCreatePerm, userReadPerm, userUpdatePerm, userDeletePerm,
      auditReadPerm
    ];
    await this.roleRepo.save(ownerRole);

    const adminRole = this.roleRepo.create({
      name: 'admin',
      description: 'Administrator with most permissions',
    });
    adminRole.permissions = [
      taskCreatePerm, taskReadPerm, taskUpdatePerm, taskDeletePerm,
      userCreatePerm, userReadPerm, userUpdatePerm,
      auditReadPerm
    ];
    await this.roleRepo.save(adminRole);

    const viewerRole = this.roleRepo.create({
      name: 'viewer',
      description: 'Viewer with read-only access',
    });
    viewerRole.permissions = [taskReadPerm, userReadPerm];
    await this.roleRepo.save(viewerRole);

    // Create organizations
    const techCorp = this.orgRepo.create({
      name: 'TechCorp Inc',
      description: 'Technology company',
    });
    await this.orgRepo.save(techCorp);

    const startupLab = this.orgRepo.create({
      name: 'StartupLab',
      description: 'Startup accelerator',
    });
    await this.orgRepo.save(startupLab);

    // Create users
    const hashedPassword = await bcrypt.hash('password123', 10);

    const owner = this.userRepo.create({
      email: 'owner@techcorp.com',
      password: hashedPassword,
      name: 'Owner User',
      firstName: 'Owner',
      lastName: 'User',
    });
    owner.role = ownerRole;
    owner.organization = techCorp;
    await this.userRepo.save(owner);

    const admin = this.userRepo.create({
      email: 'admin@techcorp.com',
      password: hashedPassword,
      name: 'Admin User',
      firstName: 'Admin',
      lastName: 'User',
    });
    admin.role = adminRole;
    admin.organization = techCorp;
    await this.userRepo.save(admin);

    const viewer = this.userRepo.create({
      email: 'viewer@techcorp.com',
      password: hashedPassword,
      name: 'Viewer User',
      firstName: 'Viewer',
      lastName: 'User',
    });
    viewer.role = viewerRole;
    viewer.organization = techCorp;
    await this.userRepo.save(viewer);

    const startupOwner = this.userRepo.create({
      email: 'owner@startuplab.com',
      password: hashedPassword,
      name: 'Startup Owner',
      firstName: 'Startup',
      lastName: 'Owner',
    });
    startupOwner.role = ownerRole;
    startupOwner.organization = startupLab;
    await this.userRepo.save(startupOwner);

    // Create tasks
    const task1 = this.taskRepo.create({
      title: 'Design new landing page',
      description: 'Create mockups for the new product landing page',
      status: 'pending',
      priority: 'high',
      dueDate: new Date('2025-11-30'),
    });
    task1.assignedTo = admin;
    task1.createdBy = owner;
    task1.organization = techCorp;
    await this.taskRepo.save(task1);

    const task2 = this.taskRepo.create({
      title: 'Review Q4 analytics',
      description: 'Analyze user engagement metrics from Q4',
      status: 'in-progress',
      priority: 'medium',
      dueDate: new Date('2025-11-24'),
    });
    task2.assignedTo = viewer;
    task2.createdBy = admin;
    task2.organization = techCorp;
    await this.taskRepo.save(task2);

    const task3 = this.taskRepo.create({
      title: 'Setup CI/CD pipeline',
      description: 'Configure automated deployment pipeline',
      status: 'completed',
      priority: 'high',
      dueDate: new Date('2025-11-20'),
    });
    task3.assignedTo = admin;
    task3.createdBy = owner;
    task3.organization = techCorp;
    await this.taskRepo.save(task3);

    const task4 = this.taskRepo.create({
      title: 'Prepare investor pitch',
      description: 'Create presentation for Series A funding',
      status: 'pending',
      priority: 'high',
      dueDate: new Date('2025-12-01'),
    });
    task4.assignedTo = startupOwner;
    task4.createdBy = startupOwner;
    task4.organization = startupLab;
    await this.taskRepo.save(task4);

    return {
      organizations: 2,
      users: 4,
      roles: 3,
      permissions: 9,
      tasks: 4,
    };
  }
}
