import { Controller, Get } from '@nestjs/common';
import { HealthCheck } from '@nestjs/terminus';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @HealthCheck()
  liveness() {
    return this.healthService.checkLiveness();
  }

  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.healthService.checkReadiness();
  }
}
