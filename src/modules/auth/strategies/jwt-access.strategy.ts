import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RequestUser } from '../../../common/types/authenticated-request';
import { AppConfig } from '../../../config/configuration';
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
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<AppConfig>('app')!.jwt.accessSecret,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<RequestUser> {
    const user = await this.usersService.findByIdOrThrow(payload.sub);
    // Role/permissions are wired in once the RBAC module exists (see roles.module.ts);
    // every authenticated user is treated as a plain 'customer' until then.
    return {
      userId: user._id.toString(),
      email: user.email,
      roleName: 'customer',
      permissions: [],
    };
  }
}
