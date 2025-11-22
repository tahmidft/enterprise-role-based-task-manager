import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role } from '../../entities/role.entity';
import { Organization } from '../../entities/organization.entity';
import { User } from '../../entities/user.entity';
import { Task } from '../../entities/task.entity';

@Injectable()
export class SeedService {
  constructor(
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(Organization)
    private orgRepo: Repository<Organization>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Task)
    private taskRepo: Repository<Task>,
  ) {}

  async seed() {
    console.log('🌱 Starting database seeding...');

    // Clear existing data - use clear() instead of delete({})
    await this.taskRepo.clear();
    await this.userRepo.clear();
    await this.orgRepo.clear();
    await this.roleRepo.clear();

    console.log('🗑️  Cleared existing data');

    // 1. Create Roles
    const adminRole = this.roleRepo.create({
      name: 'admin',
      permissions: [
        'tasks:create',
        'tasks:read',
        'tasks:update',
        'tasks:delete',
        'users:create',
        'users:read',
        'users:update',
        'users:delete',
        'organizations:create',
        'organizations:read',
        'organizations:update',
        'organizations:delete',
      ],
    });

    const managerRole = this.roleRepo.create({
      name: 'manager',
      permissions: [
        'tasks:create',
        'tasks:read',
        'tasks:update',
        'tasks:delete',
        'users:read',
      ],
    });

    const employeeRole = this.roleRepo.create({
      name: 'employee',
      permissions: ['tasks:read', 'tasks:update'],
    });

    await this.roleRepo.save([adminRole, managerRole, employeeRole]);
    console.log('✅ Roles created');

    // 2. Create Organizations
    const techCorp = this.orgRepo.create({
      name: 'TechCorp Inc',
      industry: 'Technology',
      employeeCount: 250,
    });

    const innovateLab = this.orgRepo.create({
      name: 'InnovateLab',
      industry: 'Research',
      employeeCount: 50,
    });

    await this.orgRepo.save([techCorp, innovateLab]);
    console.log('✅ Organizations created');

    // 3. Create Users
    const hashedPassword = await bcrypt.hash('password123', 10);

    const adminUser = this.userRepo.create({
      email: 'admin@techcorp.com',
      username: 'admin',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: adminRole,
      organization: techCorp,
    });

    const manager1 = this.userRepo.create({
      email: 'sarah.johnson@techcorp.com',
      username: 'sjohnson',
      password: hashedPassword,
      firstName: 'Sarah',
      lastName: 'Johnson',
      role: managerRole,
      organization: techCorp,
    });

    const employee1 = this.userRepo.create({
      email: 'john.doe@techcorp.com',
      username: 'jdoe',
      password: hashedPassword,
      firstName: 'John',
      lastName: 'Doe',
      role: employeeRole,
      organization: techCorp,
    });

    const employee2 = this.userRepo.create({
      email: 'jane.smith@innovatelab.com',
      username: 'jsmith',
      password: hashedPassword,
      firstName: 'Jane',
      lastName: 'Smith',
      role: employeeRole,
      organization: innovateLab,
    });

    await this.userRepo.save([adminUser, manager1, employee1, employee2]);
    console.log('✅ Users created (password: password123)');

    // 4. Create Tasks
    const task1 = this.taskRepo.create({
      title: 'Design new landing page',
      description: 'Create mockups for the new product landing page',
      status: 'pending',
      priority: 'high',
      assignedTo: employee1,
      createdBy: manager1,
      organization: techCorp,
      dueDate: new Date('2025-12-01'),
    });

    const task2 = this.taskRepo.create({
      title: 'Review Q4 analytics',
      description: 'Analyze user engagement metrics from Q4',
      status: 'in-progress',
      priority: 'medium',
      assignedTo: employee1,
      createdBy: manager1,
      organization: techCorp,
      dueDate: new Date('2025-11-25'),
    });

    const task3 = this.taskRepo.create({
      title: 'Update API documentation',
      description: 'Document all new endpoints added in v2.0',
      status: 'completed',
      priority: 'low',
      assignedTo: employee2,
      createdBy: adminUser,
      organization: innovateLab,
      dueDate: new Date('2025-11-15'),
      completedAt: new Date('2025-11-14'),
    });

    const task4 = this.taskRepo.create({
      title: 'Setup CI/CD pipeline',
      description: 'Configure GitHub Actions for automated testing',
      status: 'pending',
      priority: 'high',
      assignedTo: employee2,
      createdBy: adminUser,
      organization: innovateLab,
      dueDate: new Date('2025-12-05'),
    });

    await this.taskRepo.save([task1, task2, task3, task4]);
    console.log('✅ Tasks created');

    console.log('🎉 Seeding complete!');
    console.log('\n📋 Test Users:');
    console.log('  Admin: admin@techcorp.com / password123');
    console.log('  Manager: sarah.johnson@techcorp.com / password123');
    console.log('  Employee: john.doe@techcorp.com / password123');
  }
}