export class LoginDto {
  email!: string;
  password!: string;
}

export class RegisterDto {
  email!: string;
  password!: string;
  name!: string;
  organizationName!: string;
}

export class AuthResponseDto {
  access_token!: string;
  user!: {
    id: string;
    email: string;
    name: string;
    firstName: string;
    lastName: string;
    roleId: string;
    organizationId: string;
    role?: unknown;
    organization?: unknown;
    createdAt: Date;
    updatedAt: Date;
  };
}
