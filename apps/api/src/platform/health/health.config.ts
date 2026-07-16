import { ModuleMetadata } from '@nestjs/common';
import { HealthIndicatorFunction } from '@nestjs/terminus';

/**
 * Config modułu health. Dziś realnie pusty — samo `checks` zostawione
 * na przyszłość (DB, zewnętrzni providerzy w Fazie 3), żeby nie trzeba
 * było zmieniać sygnatury `forRoot`/`forRootAsync`, gdy faktycznie
 * dojdą realne sprawdzenia zależności.
 */
export interface HealthModuleConfig {
  /**
   * Health indicatory dopinane do /ready (np. TypeOrmHealthIndicator,
   * gdy Postgres/TypeORM będzie podpięte). Puste na start — /ready
   * zachowuje się jak /health, dopóki nie ma żadnych zależności.
   */
  checks?: HealthIndicatorFunction[];
}

export interface HealthModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (
    ...args: any[]
  ) => Promise<HealthModuleConfig> | HealthModuleConfig;
  inject?: any[];
}

export const HEALTH_MODULE_CONFIG = Symbol('HEALTH_MODULE_CONFIG');
