import {
  Controller,
  Get,
  NotFoundException,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CsrfService } from './csrf/csrf.service';

@Controller('security')
export class SecurityController {
  constructor(private readonly csrfService: CsrfService) {}

  // GET is a CSRF-safe method, so this endpoint is reachable without a
  // token — that's the whole point: the client fetches its first token here
  // (cookie set as side effect, token value in the body) before making any
  // state-changing request.
  @Get('csrf-token')
  getCsrfToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): { csrfToken: string } {
    if (!this.csrfService.enabled) {
      throw new NotFoundException('CSRF protection is not enabled');
    }
    return { csrfToken: this.csrfService.generateToken(req, res) };
  }
}
