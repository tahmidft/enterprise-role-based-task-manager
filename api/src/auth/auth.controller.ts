import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from '@ftahmid-bcd36a19-7dca-4b0b-ba2f-a8c55e8071f0/data';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    const { email, password, name, organizationName } = registerDto;
    return this.authService.register(email, password, name, organizationName);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const { email, password } = loginDto;
    return this.authService.login(email, password);
  }
}
