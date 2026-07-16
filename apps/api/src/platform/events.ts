export const PLATFORM_EVENTS = {
    AUTH_USER_REGISTERED: 'auth.user.registered',
    AUTH_USER_LOGGED_IN: 'auth.user.loggedIn',
    AUTH_USER_LOGIN_FAILED: 'auth.user.loginFailed',
    SESSION_REVOKED: 'session.revoked',
    RBAC_ROLE_ASSIGNED: 'rbac.roleAssigned',
    TENANT_CREATED: 'tenant.created',
    API_KEY_CREATED: 'apiKey.created',
    API_KEY_REVOKED: 'apiKey.revoked',
    SECURITY_REQUEST_REJECTED: 'security.requestRejected',
    SECRETS_ROTATED: 'secrets.rotated',
    RATE_LIMIT_EXCEEDED: 'rateLimit.exceeded',
    FILE_UPLOADED: 'file.uploaded',
    FILE_DELETED: 'file.deleted',
    NOTIFICATION_SENT: 'notification.sent',
    NOTIFICATION_FAILED: 'notification.failed',
    CONSENT_GRANTED: 'consent.granted',
    CONSENT_REVOKED: 'consent.revoked',
    WEBHOOK_RECEIVED: 'webhook.received',
    BILLING_SUBSCRIPTION_UPDATED: 'billing.subscription.updated',
    USAGE_LIMIT_EXCEEDED: 'usage.limitExceeded',
    FEATURE_FLAG_TOGGLED: 'featureFlag.toggled',
    CIRCUIT_BREAKER_OPENED: 'circuitBreaker.opened',
    CIRCUIT_BREAKER_CLOSED: 'circuitBreaker.closed',
    DEAD_LETTER_ADDED: 'deadLetter.added',
    WEBHOOK_DELIVERED: 'webhook.delivered',
    WEBHOOK_DELIVERY_FAILED: 'webhook.deliveryFailed',
    SCHEDULER_JOB_COMPLETED: 'scheduler.jobCompleted',
    SCHEDULER_JOB_FAILED: 'scheduler.jobFailed',
    AUDIT_ENTRY_CREATED: 'audit.entryCreated',
    DATA_RETENTION_PURGED: 'dataRetention.purged',
    IMPERSONATION_STARTED: 'impersonation.started',
    IMPERSONATION_ENDED: 'impersonation.ended',
    PASSWORD_LOCKED_OUT: 'password.lockedOut',
    SANDBOX_ACTION_SIMULATED: 'sandbox.actionSimulated',
    MAINTENANCE_MODE_ENABLED: 'maintenanceMode.enabled',
    MAINTENANCE_MODE_DISABLED: 'maintenanceMode.disabled',
    BACKUP_COMPLETED: 'backup.completed',
    BACKUP_FAILED: 'backup.failed',
} as const;

export interface PlatformEventPayloadMap {
    [PLATFORM_EVENTS.AUTH_USER_REGISTERED]: { userId: string; email: string; tenantId: string };
    [PLATFORM_EVENTS.AUTH_USER_LOGGED_IN]: { userId: string; tenantId: string; method: 'password' | 'oauth' | 'mfa' };
    [PLATFORM_EVENTS.AUTH_USER_LOGIN_FAILED]: { email: string; reason: string; ip: string };
    [PLATFORM_EVENTS.SESSION_REVOKED]: { userId: string; sessionId: string; revokedBy: 'user' | 'admin' | 'system' };
    [PLATFORM_EVENTS.RBAC_ROLE_ASSIGNED]: { userId: string; tenantId: string; role: string };
    [PLATFORM_EVENTS.TENANT_CREATED]: { tenantId: string; name: string; plan: string };
    [PLATFORM_EVENTS.API_KEY_CREATED]: { tenantId: string; keyId: string; scopes: string[] };
    [PLATFORM_EVENTS.API_KEY_REVOKED]: { tenantId: string; keyId: string };
    [PLATFORM_EVENTS.SECURITY_REQUEST_REJECTED]: { reason: string; path: string; ip: string };
    [PLATFORM_EVENTS.SECRETS_ROTATED]: { secretName: string; rotatedAt: Date };
    [PLATFORM_EVENTS.RATE_LIMIT_EXCEEDED]: { tenantId: string; key: string; limit: number };
    [PLATFORM_EVENTS.FILE_UPLOADED]: { tenantId: string; fileId: string; sizeBytes: number; mimeType: string };
    [PLATFORM_EVENTS.FILE_DELETED]: { tenantId: string; fileId: string };
    [PLATFORM_EVENTS.NOTIFICATION_SENT]: { tenantId: string; channel: 'email' | 'sms'; recipient: string; template: string };
    [PLATFORM_EVENTS.NOTIFICATION_FAILED]: { tenantId: string; reason: string };
    [PLATFORM_EVENTS.CONSENT_GRANTED]: { tenantId: string; userId: string; consentType: string; version: string };
    [PLATFORM_EVENTS.CONSENT_REVOKED]: { tenantId: string; userId: string; consentType: string };
    [PLATFORM_EVENTS.WEBHOOK_RECEIVED]: { provider: string; eventType: string; verified: boolean };
    [PLATFORM_EVENTS.BILLING_SUBSCRIPTION_UPDATED]: { tenantId: string; plan: string; status: string };
    [PLATFORM_EVENTS.USAGE_LIMIT_EXCEEDED]: { tenantId: string; metric: string; limit: number; current: number };
    [PLATFORM_EVENTS.FEATURE_FLAG_TOGGLED]: { tenantId: string; flagKey: string; enabled: boolean };
    [PLATFORM_EVENTS.CIRCUIT_BREAKER_OPENED]: { provider: string };
    [PLATFORM_EVENTS.CIRCUIT_BREAKER_CLOSED]: { provider: string };
    [PLATFORM_EVENTS.DEAD_LETTER_ADDED]: { originalEvent: string; payload: unknown; failureReason: string };
    [PLATFORM_EVENTS.WEBHOOK_DELIVERED]: { tenantId: string; url: string; statusCode: number };
    [PLATFORM_EVENTS.WEBHOOK_DELIVERY_FAILED]: { tenantId: string; url: string; attempt: number };
    [PLATFORM_EVENTS.SCHEDULER_JOB_COMPLETED]: { jobName: string; durationMs: number };
    [PLATFORM_EVENTS.SCHEDULER_JOB_FAILED]: { jobName: string; reason: string };
    [PLATFORM_EVENTS.AUDIT_ENTRY_CREATED]: { eventName: string; actorId: string | null; tenantId: string | null; timestamp: Date };
    [PLATFORM_EVENTS.DATA_RETENTION_PURGED]: { tenantId: string; resourceType: string; resourceId: string };
    [PLATFORM_EVENTS.IMPERSONATION_STARTED]: { adminId: string; targetUserId: string; tenantId: string };
    [PLATFORM_EVENTS.IMPERSONATION_ENDED]: { adminId: string; targetUserId: string };
    [PLATFORM_EVENTS.PASSWORD_LOCKED_OUT]: { userId: string; failedAttempts: number };
    [PLATFORM_EVENTS.SANDBOX_ACTION_SIMULATED]: { tenantId: string; action: string };
    [PLATFORM_EVENTS.MAINTENANCE_MODE_ENABLED]: { reason: string };
    [PLATFORM_EVENTS.MAINTENANCE_MODE_DISABLED]: { reason: string };
    [PLATFORM_EVENTS.BACKUP_COMPLETED]: { backupId: string; sizeBytes: number; encrypted: boolean };
    [PLATFORM_EVENTS.BACKUP_FAILED]: { reason: string };
}

