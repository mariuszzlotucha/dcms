export interface SchedulerModuleConfig {
  idempotencyCleanupCron: string;
  secretsRotationCron: string;
  dataRetentionCleanupCron: string;
}

export const SCHEDULER_MODULE_CONFIG = 'SCHEDULER_MODULE_CONFIG';
