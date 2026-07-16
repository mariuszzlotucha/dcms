import { Controller, Get } from '@nestjs/common';
import { HealthCheck } from '@nestjs/terminus';
import { HealthService } from './health.service';

/**
 * UWAGA: te endpointy muszą być publiczne, bez guardów autoryzacji
 * (odpytuje je infrastruktura — Render, load balancery, monitoring —
 * bez tokenu JWT).
 *
 * Ten kontroler świadomie NIE ma żadnego @UseGuards(...), więc jeśli
 * w AppModule guard autoryzacji jest podpięty lokalnie per-kontroler,
 * nic dodatkowo nie trzeba robić. Jeśli natomiast guard jest globalny
 * (APP_GUARD w AppModule), doklej tu wasz odpowiednik @Public()
 * (dekorator ustawiający metadane odczytywane przez ten guard), żeby
 * globalny guard go przepuścił — inaczej /health i /ready oberwą 401
 * od infrastruktury, która nie ma jak wysłać tokenu.
 */
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
