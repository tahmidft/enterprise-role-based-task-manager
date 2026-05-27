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
    // Idempotent seed: upsert stable reference data and only create demo rows if missing.
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
    ] as const;

    await this.permRepo.upsert([...permissions], { conflictPaths: ['name'] });
    const persistedPerms = await this.permRepo.find();
    const permByName = new Map(persistedPerms.map(p => [p.name, p]));

    await this.orgRepo.upsert(
      [
        { name: 'TechCorp Inc', description: 'Technology company' },
        { name: 'StartupLab', description: 'Startup accelerator' },
      ],
      { conflictPaths: ['name'] },
    );
    const [techCorp, startupLab] = await Promise.all([
      this.orgRepo.findOneByOrFail({ name: 'TechCorp Inc' }),
      this.orgRepo.findOneByOrFail({ name: 'StartupLab' }),
    ]);

    await this.roleRepo.upsert(
      [
        { name: 'owner', description: 'Organization owner with full access' },
        { name: 'admin', description: 'Administrator with most permissions' },
        { name: 'viewer', description: 'Viewer with read-only access' },
      ],
      { conflictPaths: ['name'] },
    );

    const roles = await this.roleRepo.find({ relations: { permissions: true } });
    const roleByName = new Map(roles.map(r => [r.name, r]));

    const requirePerm = (name: (typeof permissions)[number]['name']) => {
      const perm = permByName.get(name);
      if (!perm) throw new Error(`Missing permission '${name}' after upsert`);
      return perm;
    };

    const ownerRole = roleByName.get('owner');
    const adminRole = roleByName.get('admin');
    const viewerRole = roleByName.get('viewer');
    if (!ownerRole || !adminRole || !viewerRole) {
      throw new Error('Missing seeded roles after upsert');
    }

    ownerRole.permissions = permissions.map(p => requirePerm(p.name));
    adminRole.permissions = [
      requirePerm('tasks:create'),
      requirePerm('tasks:read'),
      requirePerm('tasks:update'),
      requirePerm('tasks:delete'),
      requirePerm('users:create'),
      requirePerm('users:read'),
      requirePerm('users:update'),
      requirePerm('audit:read'),
    ];
    viewerRole.permissions = [requirePerm('tasks:read'), requirePerm('users:read')];
    await this.roleRepo.save([ownerRole, adminRole, viewerRole]);

    const hashedPassword = await bcrypt.hash('password123', 10);
    const ensureUser = async (input: {
      email: string;
      name: string;
      firstName: string;
      lastName: string;
      roleId: string;
      organizationId: string;
    }) => {
      const existing = await this.userRepo.findOne({ where: { email: input.email } });
      if (existing) {
        let changed = false;
        if (existing.roleId !== input.roleId) {
          existing.roleId = input.roleId;
          changed = true;
        }
        if (existing.organizationId !== input.organizationId) {
          existing.organizationId = input.organizationId;
          changed = true;
        }
        if (changed) await this.userRepo.save(existing);
        return existing;
      }
      const created = this.userRepo.create({
        ...input,
        password: hashedPassword,
      });
      return await this.userRepo.save(created);
    };

    const owner = await ensureUser({
      email: 'owner@techcorp.com',
      name: 'Owner User',
      firstName: 'Owner',
      lastName: 'User',
      roleId: ownerRole.id,
      organizationId: techCorp.id,
    });
    const admin = await ensureUser({
      email: 'admin@techcorp.com',
      name: 'Admin User',
      firstName: 'Admin',
      lastName: 'User',
      roleId: adminRole.id,
      organizationId: techCorp.id,
    });
    const viewer = await ensureUser({
      email: 'viewer@techcorp.com',
      name: 'Viewer User',
      firstName: 'Viewer',
      lastName: 'User',
      roleId: viewerRole.id,
      organizationId: techCorp.id,
    });
    const startupOwner = await ensureUser({
      email: 'owner@startuplab.com',
      name: 'Startup Owner',
      firstName: 'Startup',
      lastName: 'Owner',
      roleId: ownerRole.id,
      organizationId: startupLab.id,
    });

    const ensureTask = async (input: {
      title: string;
      description: string;
      status: string;
      priority: string;
      dueDate: Date;
      assignedToId?: string;
      createdById?: string;
      organizationId: string;
    }) => {
      const existing = await this.taskRepo.findOne({
        where: { title: input.title, organizationId: input.organizationId },
      });
      if (existing) return existing;
      return await this.taskRepo.save(this.taskRepo.create(input));
    };

    await ensureTask({
      title: 'Design new landing page',
      description: 'Create mockups for the new product landing page',
      status: 'pending',
      priority: 'high',
      dueDate: new Date('2025-11-30T00:00:00.000Z'),
      assignedToId: admin.id,
      createdById: owner.id,
      organizationId: techCorp.id,
    });

    await ensureTask({
      title: 'Review Q4 analytics',
      description: 'Analyze user engagement metrics from Q4',
      status: 'in-progress',
      priority: 'medium',
      dueDate: new Date('2025-11-24T00:00:00.000Z'),
      assignedToId: viewer.id,
      createdById: admin.id,
      organizationId: techCorp.id,
    });

    await ensureTask({
      title: 'Setup CI/CD pipeline',
      description: 'Configure automated deployment pipeline',
      status: 'completed',
      priority: 'high',
      dueDate: new Date('2025-11-20T00:00:00.000Z'),
      assignedToId: admin.id,
      createdById: owner.id,
      organizationId: techCorp.id,
    });

    await ensureTask({
      title: 'Prepare investor pitch',
      description: 'Create presentation for Series A funding',
      status: 'pending',
      priority: 'high',
      dueDate: new Date('2025-12-01T00:00:00.000Z'),
      assignedToId: startupOwner.id,
      createdById: startupOwner.id,
      organizationId: startupLab.id,
    });

    const [organizations, users, rolesCount, permissionsCount, tasks] = await Promise.all([
      this.orgRepo.count(),
      this.userRepo.count(),
      this.roleRepo.count(),
      this.permRepo.count(),
      this.taskRepo.count(),
    ]);

    return { organizations, users, roles: rolesCount, permissions: permissionsCount, tasks };
  }
}
