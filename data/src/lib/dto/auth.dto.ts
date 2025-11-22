import { IsEmail, IsNotEmpty, MinLength, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @MinLength(6)
  password!: string;
}

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsNotEmpty()
  @IsString()
  firstName!: string;

  @IsNotEmpty()
  @IsString()
  lastName!: string;

  @IsNotEmpty()
  @IsString()
  roleId!: string;

  @IsNotEmpty()
  @IsString()
  organizationId!: string;
}

export class AuthResponseDto {
  token!: string;
  user!: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roleId: string;
    organizationId: string;
  };
}