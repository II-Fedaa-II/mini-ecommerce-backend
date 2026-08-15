import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RequestUser } from '../../../common/types/authenticated-request';
import { AppConfig } from '../../../config/configuration';
import { RolesService } from '../../roles/roles.service';
import { UsersService } from '../../users/users.service';

interface AccessTokenPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(
  Strategy,
  'jwt-access',
) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<AppConfig>('app')!.jwt.accessSecret,
    });
  }

  /**
   * Permissions are resolved from the database on every request rather than baked into
   * the token, so revoking a permission takes effect immediately instead of waiting for
   * the current access token to expire.
   */
  async validate(payload: AccessTokenPayload): Promise<RequestUser> {
    const user = await this.usersService.findByIdOrThrow(payload.sub);
    const role = await this.rolesService.findByIdOrThrow(
      user.roleId.toString(),
    );

    return {
      userId: user._id.toString(),
      email: user.email,
      roleName: role.name,
      permissions: role.permissions,
    };
  }
}
