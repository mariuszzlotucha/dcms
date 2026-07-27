export interface SchedulerModuleConfig {
  idempotencyCleanupCron: string;
  secretsRotationCron: string;
}

export const SCHEDULER_MODULE_CONFIG = 'SCHEDULER_MODULE_CONFIG';
