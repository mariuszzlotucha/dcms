import { ModuleMetadata } from '@nestjs/common';
import { HealthIndicatorFunction } from '@nestjs/terminus';

export interface HealthModuleConfig {
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
