export interface DataRetentionModuleConfig {
  inactiveAccountDeletionDays: number;
  revokedConsentPurgeDays: number;
}

export const DATA_RETENTION_MODULE_CONFIG = 'DATA_RETENTION_MODULE_CONFIG';

export const USER_ACCOUNT_QUERIES = 'USER_ACCOUNT_QUERIES';

export interface UserAccountQueries {
  findUserIdsInactiveSince(cutoff: Date): Promise<string[]>;
  userExists(userId: string): Promise<boolean>;
  deleteUser(userId: string): Promise<void>;
}
