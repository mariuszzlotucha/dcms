export interface PasswordPolicyModuleConfig {
  minLength: number;
  requireNumber: boolean;
  requireLetter: boolean;
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
}

export const PASSWORD_POLICY_MODULE_CONFIG = 'PASSWORD_POLICY_MODULE_CONFIG';
