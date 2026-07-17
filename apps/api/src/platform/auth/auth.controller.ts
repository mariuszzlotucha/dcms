import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Request } from 'express';
import { AuthService, OauthProfile } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OauthGuard } from './guards/oauth.guard';
import { AuthenticatedUser } from './strategies/jwt.strategy';

export class RegisterDto {
  @IsEmail()
  email!: string;

  // MaxLength is a DoS cap (argon2 cost scales with input size), NOT a
  // strength policy — minimum length/complexity stays with password-policy
  // (Phase 4).
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.login(dto.email, dto.password, ip);
  }

  @Get('google')
  @UseGuards(OauthGuard('google'))
  googleAuth(): void {
    // Passport redirects to Google before this body runs.
  }

  @Get('google/callback')
  @UseGuards(OauthGuard('google'))
  googleCallback(
    @Req() req: Request & { user: OauthProfile },
    @Ip() ip: string,
  ) {
    return this.authService.oauthLogin(req.user, 'google', ip);
  }

  @Get('linkedin')
  @UseGuards(OauthGuard('linkedin'))
  linkedinAuth(): void {
    // Passport redirects to LinkedIn before this body runs.
  }

  @Get('linkedin/callback')
  @UseGuards(OauthGuard('linkedin'))
  linkedinCallback(
    @Req() req: Request & { user: OauthProfile },
    @Ip() ip: string,
  ) {
    return this.authService.oauthLogin(req.user, 'linkedin', ip);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request & { user: AuthenticatedUser }): AuthenticatedUser {
    return req.user;
  }
}
