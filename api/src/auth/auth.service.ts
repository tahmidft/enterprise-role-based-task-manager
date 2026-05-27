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
import { RefreshToken } from '../entities/refresh-token.entity';
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
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
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
    const tokenHash = this.hashToken(rawToken);
    const stored = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
      relations: ['user', 'user.role', 'user.role.permissions', 'user.organization'],
    });

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.refreshTokenRepository.update(stored.id, { revoked: true });

    return this.buildTokens(stored.user);
  }

  async logout(rawToken: string): Promise<void> {
    if (!rawToken) return;
    const tokenHash = this.hashToken(rawToken);
    await this.refreshTokenRepository.update({ tokenHash }, { revoked: true });
  }

  async validateUser(userId: string) {
    return this.userRepository.findOne({
      where: { id: userId },
      relations: ['role', 'role.permissions', 'organization'],
    });
  }

  async invalidateAllUserRefreshTokens(userId: string): Promise<void> {
    await this.refreshTokenRepository.update({ userId }, { revoked: true });
  }

  private async buildTokens(user: User) {
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    const rawRefreshToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);

    const ttlDays = Number(
      this.configService.get<string>('REFRESH_TOKEN_TTL_DAYS') ?? '30',
    );
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ttlDays);

    const rt = this.refreshTokenRepository.create({
      tokenHash,
      userId: user.id,
      expiresAt,
      revoked: false,
    });
    await this.refreshTokenRepository.save(rt);

    return { access_token: accessToken, refresh_token: rawRefreshToken, user };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
