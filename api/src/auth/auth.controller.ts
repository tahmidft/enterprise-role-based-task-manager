import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RegisterDto,
} from '@ftahmid-bcd36a19-7dca-4b0b-ba2f-a8c55e8071f0/data';

const REFRESH_COOKIE = 'refresh_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env['NODE_ENV'] === 'production',
  path: '/api/auth',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { email, password, name, organizationName } = registerDto;
    const result = await this.authService.register(
      email,
      password,
      name,
      organizationName,
    );
    res.cookie(REFRESH_COOKIE, result.refresh_token, COOKIE_OPTIONS);
    return { access_token: result.access_token, user: result.user };
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { email, password } = loginDto;
    const result = await this.authService.login(email, password);
    res.cookie(REFRESH_COOKIE, result.refresh_token, COOKIE_OPTIONS);
    return { access_token: result.access_token, user: result.user };
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken: string | undefined = req.cookies?.[REFRESH_COOKIE];
    if (!rawToken) {
      throw new (await import('@nestjs/common').then(m => m.UnauthorizedException))(
        'No refresh token',
      );
    }
    const result = await this.authService.refresh(rawToken);
    res.cookie(REFRESH_COOKIE, result.refresh_token, COOKIE_OPTIONS);
    return { access_token: result.access_token, user: result.user };
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken: string | undefined = req.cookies?.[REFRESH_COOKIE];
    if (rawToken) {
      await this.authService.logout(rawToken);
    }
    res.clearCookie(REFRESH_COOKIE, { ...COOKIE_OPTIONS, maxAge: 0 });
  }
}
