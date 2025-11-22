import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Organization } from '../entities/organization.entity';
import { Role } from '../entities/role.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Organization)
    private orgRepository: Repository<Organization>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    private jwtService: JwtService,
  ) {}

  async register(email: string, password: string, name: string, organizationName: string) {
    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    // Create organization
    const organization = this.orgRepository.create({ name: organizationName });
    await this.orgRepository.save(organization);

    // Get admin role (should exist from seed)
    const adminRole = await this.roleRepository.findOne({ where: { name: 'admin' } });
    if (!adminRole) {
      throw new Error('Admin role not found. Please run seed first.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const nameParts = name.split(' ');
    const firstName = nameParts[0] || '';
    const lastNameParts = nameParts.slice(1);
    const lastName = lastNameParts.join(' ') || '';

    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      name,
      firstName,
      lastName,
      roleId: adminRole.id,
      organizationId: organization.id,
    });

    const savedUser = await this.userRepository.save(user);

    const userWithRelations = await this.userRepository.findOne({
      where: { id: savedUser.id },
      relations: ['role', 'organization'],
    });

    const payload = { sub: userWithRelations!.id, email: userWithRelations!.email };
    return {
      access_token: this.jwtService.sign(payload),
      user: userWithRelations,
    };
  }

  async login(email: string, password: string) {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['role', 'role.permissions', 'organization'],
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email };
    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  async validateUser(userId: string) {
    return this.userRepository.findOne({
      where: { id: userId },
      relations: ['role', 'role.permissions', 'organization'],
    });
  }
}
