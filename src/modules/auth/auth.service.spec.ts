import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {
  InvalidCredentialsException,
  InvalidRefreshTokenException,
  RefreshTokenReuseException,
} from '../../common/exceptions/domain.exceptions';
import { RolesService } from '../roles/roles.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let refreshTokenRepository: jest.Mocked<RefreshTokenRepository>;
  let rolesService: jest.Mocked<RolesService>;

  const mockUser = {
    _id: { toString: () => 'user-1' },
    email: 'test@example.com',
    passwordHash: '',
    roleId: { toString: () => 'role-1' },
  } as any;

  beforeEach(async () => {
    mockUser.passwordHash = await bcrypt.hash('correct-password', 4);

    usersService = {
      findByEmailWithPassword: jest.fn(),
      findByIdOrThrow: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    refreshTokenRepository = {
      create: jest.fn(),
      findByHash: jest.fn(),
      revoke: jest.fn(),
      revokeFamily: jest.fn(),
    } as unknown as jest.Mocked<RefreshTokenRepository>;

    const jwtService = new JwtService({});
    const configService = {
      get: () => ({
        jwt: {
          accessSecret: 'access-secret',
          accessExpiresIn: '15m',
          refreshSecret: 'refresh-secret',
          refreshExpiresIn: '7d',
        },
      }),
    } as unknown as ConfigService;

    rolesService = {
      findByIdOrThrow: jest.fn().mockResolvedValue({
        _id: { toString: () => 'role-1' },
        name: 'customer',
        permissions: ['products:read'],
      }),
    } as unknown as jest.Mocked<RolesService>;

    service = new AuthService(
      usersService,
      refreshTokenRepository,
      jwtService,
      configService,
      rolesService,
    );
  });

  describe('login', () => {
    it('issues an access and refresh token for valid credentials', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(mockUser);
      refreshTokenRepository.create.mockResolvedValue({} as any);

      const result = await service.login(
        'test@example.com',
        'correct-password',
      );

      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(refreshTokenRepository.create).toHaveBeenCalledTimes(1);
    });

    it('throws InvalidCredentialsException for the wrong password', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(mockUser);
      await expect(
        service.login('test@example.com', 'wrong-password'),
      ).rejects.toThrow(InvalidCredentialsException);
    });

    it('throws InvalidCredentialsException when the user does not exist', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(null);
      await expect(
        service.login('nobody@example.com', 'whatever'),
      ).rejects.toThrow(InvalidCredentialsException);
    });
  });

  describe('refresh', () => {
    it('rotates the token on first (legitimate) use', async () => {
      const existing = {
        _id: { toString: () => 'token-1' },
        familyId: 'family-1',
        revoked: false,
        expiresAt: new Date(Date.now() + 100_000),
        userId: { toString: () => 'user-1' },
      };
      refreshTokenRepository.findByHash.mockResolvedValue(existing as any);
      usersService.findByIdOrThrow.mockResolvedValue(mockUser);
      refreshTokenRepository.create.mockResolvedValue({} as any);

      const result = await service.refresh('raw-token');

      expect(refreshTokenRepository.revoke).toHaveBeenCalledWith('token-1');
      expect(refreshTokenRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ familyId: 'family-1' }),
      );
      expect(result.accessToken).toEqual(expect.any(String));
    });

    it('revokes the whole token family and throws when a rotated-out token is replayed', async () => {
      const existing = {
        _id: { toString: () => 'token-1' },
        familyId: 'family-1',
        revoked: true,
        expiresAt: new Date(Date.now() + 100_000),
      };
      refreshTokenRepository.findByHash.mockResolvedValue(existing as any);

      await expect(service.refresh('stolen-token')).rejects.toThrow(
        RefreshTokenReuseException,
      );
      expect(refreshTokenRepository.revokeFamily).toHaveBeenCalledWith(
        'family-1',
      );
    });

    it('throws InvalidRefreshTokenException when no cookie is presented', async () => {
      await expect(service.refresh(undefined)).rejects.toThrow(
        InvalidRefreshTokenException,
      );
    });

    it('throws InvalidRefreshTokenException for a token that is not on record', async () => {
      refreshTokenRepository.findByHash.mockResolvedValue(null);
      await expect(service.refresh('unknown-token')).rejects.toThrow(
        InvalidRefreshTokenException,
      );
    });

    it('throws InvalidRefreshTokenException for an expired token', async () => {
      const existing = {
        _id: { toString: () => 'token-1' },
        familyId: 'family-1',
        revoked: false,
        expiresAt: new Date(Date.now() - 1_000),
      };
      refreshTokenRepository.findByHash.mockResolvedValue(existing as any);
      await expect(service.refresh('expired-token')).rejects.toThrow(
        InvalidRefreshTokenException,
      );
    });
  });
});
