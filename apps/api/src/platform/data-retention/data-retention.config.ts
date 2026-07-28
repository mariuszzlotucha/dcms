export interface DataRetentionModuleConfig {
  inactiveAccountDeletionDays: number;
  revokedConsentPurgeDays: number;
}

export const DATA_RETENTION_MODULE_CONFIG = 'DATA_RETENTION_MODULE_CONFIG';
