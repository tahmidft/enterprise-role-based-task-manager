import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    // Debug logging
    console.log('Required permissions:', requiredPermissions);
    console.log('User:', JSON.stringify(user, null, 2));
    console.log('User role:', user?.role);
    console.log('User role permissions:', user?.role?.permissions);
    
    if (!user || !user.role || !user.role.permissions) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const userPermissions = user.role.permissions.map((p: any) => p.name);
    console.log('User permission names:', userPermissions);
    
    const hasPermission = requiredPermissions.some(permission => 
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      throw new ForbiddenException(`You need the following permissions: ${requiredPermissions.join(', ')}`);
    }

    return true;
  }
}
