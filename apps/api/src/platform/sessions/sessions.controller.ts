import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import {
  RefreshTokenGuard,
  RequestWithRefreshToken,
} from './guards/refresh-token.guard';
import { SessionsService } from './sessions.service';

type AuthedRequest = Request & { user: AuthenticatedUser };

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  // Entry point for a logged-in client to obtain its refresh token —
  // exists because auth's login flow does not change (per spec) and thus
  // cannot mint sessions itself.
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() req: AuthedRequest) {
    return this.sessionsService.createSession(req.user.userId);
  }

  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  @HttpCode(HttpStatus.OK)
  refresh(@Req() req: RequestWithRefreshToken) {
    return this.sessionsService.rotateSession(req.refreshToken);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Req() req: AuthedRequest) {
    return this.sessionsService.listActiveSessions(req.user.userId);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeAll(@Req() req: AuthedRequest): Promise<void> {
    await this.sessionsService.revokeAllSessions(req.user.userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.sessionsService.revokeSession(id, req.user.userId);
  }
}
