import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Organization } from '../../entities/organization.entity';
import { Role } from '../../entities/role.entity';
import { Permission } from '../../entities/permission.entity';
import { Task } from '../../entities/task.entity';
import { Project } from '../../entities/project.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SeedService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Organization) private orgRepo: Repository<Organization>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(Permission) private permRepo: Repository<Permission>,
    @InjectRepository(Task) private taskRepo: Repository<Task>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
  ) {}

  async seed() {
    const permissions = [
      { name: 'tasks:create', description: 'Create tasks' },
      { name: 'tasks:read', description: 'Read tasks' },
      { name: 'tasks:update', description: 'Update tasks' },
      { name: 'tasks:delete', description: 'Delete tasks' },
      { name: 'users:create', description: 'Create users' },
      { name: 'users:read', description: 'Read users' },
      { name: 'users:update', description: 'Update users' },
      { name: 'users:delete', description: 'Delete users' },
      { name: 'audit:read', description: 'Read audit logs' },
    ];
    await this.permRepo.upsert(permissions, ['name']);
    const allPerms = await this.permRepo.find();
    const byPerm = new Map(allPerms.map(p => [p.name, p]));

    const roleSeeds = [
      {
        name: 'owner',
        description: 'Organization owner with full access',
        permissions: permissions.map(p => p.name),
      },
      {
        name: 'admin',
        description: 'Administrator with most permissions',
        permissions: ['tasks:create', 'tasks:read', 'tasks:update', 'tasks:delete', 'users:create', 'users:read', 'users:update', 'audit:read'],
      },
      {
        name: 'manager',
        description: 'Project manager',
        permissions: [
          'tasks:create',
          'tasks:read',
          'tasks:update',
          'tasks:delete',
          'users:read',
          'audit:read',
        ],
      },
      {
        name: 'member',
        description: 'Team member',
        permissions: ['tasks:create', 'tasks:read', 'tasks:update'],
      },
      {
        name: 'viewer',
        description: 'Viewer with read-only access',
        permissions: ['tasks:read', 'users:read'],
      },
    ];

    for (const roleSeed of roleSeeds) {
      await this.roleRepo.upsert({ name: roleSeed.name, description: roleSeed.description }, ['name']);
      const role = await this.roleRepo.findOneByOrFail({ name: roleSeed.name });
      role.permissions = roleSeed.permissions.map(name => byPerm.get(name)!).filter(Boolean);
      await this.roleRepo.save(role);
    }

    await this.orgRepo.upsert(
      [
        { name: 'TechCorp Inc', description: 'Technology company' },
        { name: 'StartupLab', description: 'Startup accelerator' },
      ],
      ['name'],
    );
    const techCorp = await this.orgRepo.findOneByOrFail({ name: 'TechCorp Inc' });
    const startupLab = await this.orgRepo.findOneByOrFail({ name: 'StartupLab' });

    const hashedPassword = await bcrypt.hash('password123', 10);
    const ensureUser = async (
      email: string,
      name: string,
      roleName: string,
      organizationId: string,
    ) => {
      const role = await this.roleRepo.findOneByOrFail({ name: roleName });
      const [firstName, ...rest] = name.split(' ');
      const lastName = rest.join(' ') || 'User';
      const existing = await this.userRepo.findOne({ where: { email } });
      if (existing) {
        existing.password = hashedPassword;
        return this.userRepo.save(existing);
      }
      return this.userRepo.save(
        this.userRepo.create({
          email,
          password: hashedPassword,
          name,
          firstName,
          lastName,
          roleId: role.id,
          organizationId,
        }),
      );
    };

    const owner = await ensureUser('owner@techcorp.com', 'Owner User', 'owner', techCorp.id);
    const admin = await ensureUser('admin@techcorp.com', 'Admin User', 'admin', techCorp.id);
    const manager = await ensureUser('manager@techcorp.com', 'Manager User', 'manager', techCorp.id);
    const member = await ensureUser('member@techcorp.com', 'Member User', 'member', techCorp.id);
    const viewer = await ensureUser('viewer@techcorp.com', 'Viewer User', 'viewer', techCorp.id);
    await ensureUser('owner@startuplab.com', 'Startup Owner', 'owner', startupLab.id);

    const projectSeeds = [
      { name: 'Website Revamp', description: 'Q4 delivery project', organizationId: techCorp.id },
      { name: 'Growth Initiative', description: 'Scale-up project', organizationId: techCorp.id },
    ];
    for (const projectSeed of projectSeeds) {
      const existingProject = await this.projectRepo.findOne({
        where: { name: projectSeed.name, organizationId: projectSeed.organizationId },
      });
      if (!existingProject) {
        await this.projectRepo.save(this.projectRepo.create(projectSeed));
      }
    }
    const websiteProject = await this.projectRepo.findOneByOrFail({
      name: 'Website Revamp',
      organizationId: techCorp.id,
    });

    const existingTasks = await this.taskRepo.countBy({ projectId: websiteProject.id });
    if (existingTasks === 0) {
      const parent = await this.taskRepo.save(
        this.taskRepo.create({
          title: 'Build dashboard epic',
          description: 'Parent task for dashboard delivery',
          status: 'in-progress',
          priority: 'high',
          startDate: new Date('2026-01-01'),
          dueDate: new Date('2026-12-30'),
          budgetHours: 120,
          actualHours: 64,
          completionPercent: 55,
          assignedToId: manager.id,
          createdById: owner.id,
          organizationId: techCorp.id,
          projectId: websiteProject.id,
        }),
      );

      const child1 = await this.taskRepo.save(
        this.taskRepo.create({
          title: 'Implement API contracts',
          description: 'Backend API implementation',
          status: 'completed',
          priority: 'high',
          startDate: new Date('2026-02-01'),
          dueDate: new Date('2026-11-20'),
          budgetHours: 40,
          actualHours: 44,
          completionPercent: 100,
          assignedToId: admin.id,
          createdById: owner.id,
          organizationId: techCorp.id,
          projectId: websiteProject.id,
          parentTaskId: parent.id,
        }),
      );

      const child2 = await this.taskRepo.save(
        this.taskRepo.create({
          title: 'Implement Angular dashboard',
          description: 'Frontend delivery',
          status: 'in-progress',
          priority: 'medium',
          startDate: new Date('2026-03-01'),
          dueDate: new Date('2026-12-15'),
          budgetHours: 50,
          actualHours: 20,
          completionPercent: 35,
          assignedToId: member.id,
          createdById: manager.id,
          organizationId: techCorp.id,
          projectId: websiteProject.id,
          parentTaskId: parent.id,
        }),
      );

      await this.taskRepo.save(
        this.taskRepo.create({
          title: 'UAT signoff',
          description: 'Depends on FE + BE completion',
          status: 'pending',
          priority: 'low',
          startDate: new Date('2026-06-01'),
          dueDate: new Date('2026-12-28'),
          budgetHours: 10,
          actualHours: 0,
          completionPercent: 0,
          assignedToId: viewer.id,
          createdById: manager.id,
          organizationId: techCorp.id,
          projectId: websiteProject.id,
          dependsOn: [child1, child2],
        }),
      );
    }

    return {
      organizations: await this.orgRepo.count(),
      users: await this.userRepo.count(),
      roles: await this.roleRepo.count(),
      permissions: await this.permRepo.count(),
      projects: await this.projectRepo.count(),
      tasks: await this.taskRepo.count(),
    };
  }
}
