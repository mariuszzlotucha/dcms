import { Inject, Injectable } from '@nestjs/common';
import {
  HealthCheckService,
  HealthIndicatorFunction,
} from '@nestjs/terminus';
import { HEALTH_MODULE_CONFIG, HealthModuleConfig } from './health.config';

@Injectable()
export class HealthService {
  constructor(
    private readonly health: HealthCheckService,
    @Inject(HEALTH_MODULE_CONFIG)
    private readonly config: HealthModuleConfig,
  ) {}


  checkLiveness() {
    return this.health.check([]);
  }

  checkReadiness() {
    const checks: HealthIndicatorFunction[] = this.config.checks ?? [];
    return this.health.check(checks);
  }
}
