import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Organization } from '../entities/organization.entity';
import { Role } from '../entities/role.entity';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

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
    private configService: ConfigService,
  ) {}

  async register(
    email: string,
    password: string,
    name: string,
    organizationName: string,
  ) {
    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const organization = this.orgRepository.create({ name: organizationName });
    await this.orgRepository.save(organization);

    const adminRole = await this.roleRepository.findOne({
      where: { name: 'admin' },
    });
    if (!adminRole) {
      throw new Error('Admin role not found. Please run seed first.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const nameParts = name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

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

    return this.buildTokens(userWithRelations!);
  }

  async login(email: string, password: string) {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['role', 'role.permissions', 'organization'],
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildTokens(user);
  }

  async refresh(rawToken: string) {
    const candidates = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.refreshToken')
      .addSelect('user.refreshTokenExpiry')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('role.permissions', 'permissions')
      .leftJoinAndSelect('user.organization', 'organization')
      .where('user.refreshToken IS NOT NULL')
      .andWhere('user.refreshTokenExpiry > :now', { now: new Date() })
      .getMany();

    let user: User | undefined;
    for (const candidate of candidates) {
      if (
        candidate.refreshToken &&
        (await bcrypt.compare(rawToken, candidate.refreshToken))
      ) {
        user = candidate;
        break;
      }
    }

    if (!user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    return this.buildTokens(user);
  }

  async logout(rawToken: string): Promise<void> {
    if (!rawToken) return;
    const candidates = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.refreshToken')
      .where('user.refreshToken IS NOT NULL')
      .getMany();

    for (const candidate of candidates) {
      if (
        candidate.refreshToken &&
        (await bcrypt.compare(rawToken, candidate.refreshToken))
      ) {
        await this.userRepository.update(candidate.id, {
          refreshToken: null,
          refreshTokenExpiry: null,
        });
        return;
      }
    }
  }

  async validateUser(userId: string) {
    return this.userRepository.findOne({
      where: { id: userId },
      relations: ['role', 'role.permissions', 'organization'],
    });
  }

  async invalidateAllUserRefreshTokens(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      refreshToken: null,
      refreshTokenExpiry: null,
    });
  }

  private async buildTokens(user: User) {
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    const rawRefreshToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = await bcrypt.hash(rawRefreshToken, 10);

    const ttlDays = Number(
      this.configService.get<string>('REFRESH_TOKEN_TTL_DAYS') ?? '7',
    );
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ttlDays);

    await this.userRepository.update(user.id, {
      refreshToken: tokenHash,
      refreshTokenExpiry: expiresAt,
    });

    const { password: _password, refreshToken: _rt, refreshTokenExpiry: _rte, ...safeUser } = user;
    return { access_token: accessToken, refresh_token: rawRefreshToken, user: safeUser };
  }

}
