import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AppConfig } from '../../config/configuration';
import { LoginThrottlerGuard } from '../../common/guards/login-throttler.guard';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  private readonly cookieName: string;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.cookieName =
      this.configService.get<AppConfig>('app')!.refreshCookieName;
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(LoginThrottlerGuard)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { accessToken, refreshToken, user, role } =
      await this.authService.login(dto.email, dto.password);
    this.setRefreshCookie(res, refreshToken);
    return AuthResponseDto.from(accessToken, user, role);
  }

  @Post('register')
  @HttpCode(201)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { accessToken, refreshToken, user, role } =
      await this.authService.register(dto.email, dto.password, dto.name);
    this.setRefreshCookie(res, refreshToken);
    return AuthResponseDto.from(accessToken, user, role);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const { accessToken, refreshToken } = await this.authService.refresh(
      (req.cookies as Record<string, string> | undefined)?.[this.cookieName],
    );
    this.setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: true }> {
    await this.authService.logout(
      (req.cookies as Record<string, string> | undefined)?.[this.cookieName],
    );
    res.clearCookie(this.cookieName, { path: '/auth' });
    return { success: true };
  }

  private setRefreshCookie(res: Response, refreshToken: string): void {
    res.cookie(this.cookieName, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth',
      maxAge: this.authService.refreshCookieMaxAgeMs(),
    });
  }
}
