import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { InsufficientPermissionsException } from '../exceptions/domain.exceptions';
import { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Gates role/permission-mutation routes on the literal 'admin' role name rather than a
 * dynamic permission — otherwise a role could grant itself `roles:manage` and escalate
 * its own privileges, which would defeat the point of RBAC.
 */
@Injectable()
export class AdminOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (user.roleName !== 'admin') throw new InsufficientPermissionsException('admin role');
    return true;
  }
}
