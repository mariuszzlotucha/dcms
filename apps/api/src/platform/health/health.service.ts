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

  /**
   * Liveness — proces żyje. Zero zależności do sprawdzenia,
   * bo sam fakt odpowiedzi HTTP jest dowodem, że proces działa.
   */
  checkLiveness() {
    return this.health.check([]);
  }

  /**
   * Readiness — appka gotowa przyjmować ruch. Dziś (brak DB,
   * brak zewnętrznych providerów) równoważne liveness. Docelowo
   * `config.checks` wypełni się np. TypeOrmHealthIndicator.
   */
  checkReadiness() {
    const checks: HealthIndicatorFunction[] = this.config.checks ?? [];
    return this.health.check(checks);
  }
}
