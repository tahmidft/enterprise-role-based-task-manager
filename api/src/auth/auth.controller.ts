import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginBodyDto, RefreshBodyDto, RegisterBodyDto } from './auth.dto';

const REFRESH_COOKIE = 'refresh_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env['NODE_ENV'] === 'production',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() dto: RegisterBodyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(
      dto.email,
      dto.password,
      dto.name,
      dto.organizationName,
    );
    res.cookie(REFRESH_COOKIE, result.refresh_token, COOKIE_OPTIONS);
    return { access_token: result.access_token, user: result.user };
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginBodyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto.email, dto.password);
    res.cookie(REFRESH_COOKIE, result.refresh_token, COOKIE_OPTIONS);
    return { access_token: result.access_token, user: result.user };
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Body() body: Partial<RefreshBodyDto>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken: string | undefined = req.cookies?.[REFRESH_COOKIE] ?? body.refreshToken;
    if (!rawToken) throw new UnauthorizedException('No refresh token');
    const result = await this.authService.refresh(rawToken);
    res.cookie(REFRESH_COOKIE, result.refresh_token, COOKIE_OPTIONS);
    return { access_token: result.access_token, user: result.user };
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken: string | undefined =
      req.cookies?.[REFRESH_COOKIE] ?? (req.body as { refreshToken?: string })?.refreshToken;
    if (rawToken) await this.authService.logout(rawToken);
    res.clearCookie(REFRESH_COOKIE, { ...COOKIE_OPTIONS, maxAge: 0 });
  }
}
