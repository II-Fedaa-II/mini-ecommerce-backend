import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID, createHash } from 'crypto';
import {
  InvalidCredentialsException,
  InvalidRefreshTokenException,
  RefreshTokenReuseException,
} from '../../common/exceptions/domain.exceptions';
import { CUSTOMER_ROLE_NAME } from '../roles/permissions';
import { parseDurationMs } from '../../common/utils/parse-duration';
import { AppConfig } from '../../config/configuration';
import { UserDocument } from '../users/schemas/user.schema';
import { RolesService } from '../roles/roles.service';
import { UsersService } from '../users/users.service';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly jwtConfig: AppConfig['jwt'];

  constructor(
    private readonly usersService: UsersService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly rolesService: RolesService,
  ) {
    this.jwtConfig = this.configService.get<AppConfig>('app')!.jwt;
  }

  static async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }

  async login(
    email: string,
    password: string,
  ): Promise<
    IssuedTokens & {
      user: UserDocument;
      role: { id: string; name: string; permissions: string[] } | null;
    }
  > {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new InvalidCredentialsException();
    }

    return this.issueSessionFor(user);
  }

  /**
   * Self-registered accounts always land on the built-in `customer` role — there is no
   * way to sign up as an admin or a custom role from the public form. Returns the same
   * shape as `login` so the client can log the new account straight in without a
   * second round trip.
   */
  async register(
    email: string,
    password: string,
    name: string,
  ): Promise<
    IssuedTokens & {
      user: UserDocument;
      role: { id: string; name: string; permissions: string[] } | null;
    }
  > {
    const customerRole =
      await this.rolesService.findByNameOrThrow(CUSTOMER_ROLE_NAME);
    const passwordHash = await AuthService.hashPassword(password);
    const user = await this.usersService.createAccount({
      email,
      passwordHash,
      name,
      roleId: customerRole._id.toString(),
    });

    return this.issueSessionFor(user);
  }

  private async issueSessionFor(user: UserDocument): Promise<
    IssuedTokens & {
      user: UserDocument;
      role: { id: string; name: string; permissions: string[] } | null;
    }
  > {
    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.issueRefreshToken(
      user._id.toString(),
      randomUUID(),
    );

    const roleDoc = await this.rolesService.findByIdOrThrow(
      user.roleId.toString(),
    );
    const role = {
      id: roleDoc._id.toString(),
      name: roleDoc.name,
      permissions: roleDoc.permissions,
    };

    return { accessToken, refreshToken, user, role };
  }

  async refresh(rawToken: string | undefined): Promise<IssuedTokens> {
    if (!rawToken) throw new InvalidRefreshTokenException();

    const tokenHash = this.hashToken(rawToken);
    const existing = await this.refreshTokenRepository.findByHash(tokenHash);
    if (!existing) throw new InvalidRefreshTokenException();

    if (existing.revoked) {
      // The token being presented was already rotated out once before — this is a
      // replay of a stolen or duplicated token, so the whole family is burned.
      await this.refreshTokenRepository.revokeFamily(existing.familyId);
      throw new RefreshTokenReuseException();
    }

    if (existing.expiresAt.getTime() < Date.now())
      throw new InvalidRefreshTokenException();

    await this.refreshTokenRepository.revoke(existing._id.toString());

    const user = await this.usersService.findByIdOrThrow(
      existing.userId.toString(),
    );
    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.issueRefreshToken(
      existing.userId.toString(),
      existing.familyId,
    );
    return { accessToken, refreshToken };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const existing = await this.refreshTokenRepository.findByHash(
      this.hashToken(rawToken),
    );
    if (existing)
      await this.refreshTokenRepository.revokeFamily(existing.familyId);
  }

  refreshCookieMaxAgeMs(): number {
    return parseDurationMs(this.jwtConfig.refreshExpiresIn);
  }

  private signAccessToken(user: UserDocument): string {
    return this.jwtService.sign(
      { sub: user._id.toString(), email: user.email },
      {
        secret: this.jwtConfig.accessSecret,
        expiresIn: this.jwtConfig
          .accessExpiresIn as JwtSignOptions['expiresIn'],
      },
    );
  }

  private async issueRefreshToken(
    userId: string,
    familyId: string,
  ): Promise<string> {
    const raw = randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + this.refreshCookieMaxAgeMs());
    await this.refreshTokenRepository.create({
      userId,
      tokenHash: this.hashToken(raw),
      familyId,
      expiresAt,
    });
    return raw;
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
