import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InsufficientPermissionsException } from '../exceptions/domain.exceptions';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const missing = required.find(
      (permission) => !user.permissions.includes(permission),
    );

    if (missing) throw new InsufficientPermissionsException(missing);
    return true;
  }
}
