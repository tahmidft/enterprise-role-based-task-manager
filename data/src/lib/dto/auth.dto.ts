import { IsEmail, IsNotEmpty, MinLength, IsNumber } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;
}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsNotEmpty()
  @IsNumber()
  roleId: number;

  @IsNotEmpty()
  @IsNumber()
  organizationId: number;
}

export class AuthResponseDto {
  access_token: string;
  user: {
    id: number;
    email: string;
    role: string;
    organizationId: number;
  };
}
