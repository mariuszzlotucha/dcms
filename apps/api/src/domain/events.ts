export const DOMAIN_EVENTS = {
    CONTRACT_CREATED: 'contract.created',
    CONTRACT_UPDATED: 'contract.updated',
    CONTRACT_VERSION_CREATED: 'contract.versionCreated',
    CONTRACT_STATUS_CHANGED: 'contract.statusChanged',
    CONTRACT_SUBMITTED_FOR_APPROVAL: 'contract.submittedForApproval',
    CONTRACT_ARCHIVED: 'contract.archived',
    CONTRACT_DELETED: 'contract.deleted',
    TEMPLATE_CREATED: 'template.created',
    TEMPLATE_UPDATED: 'template.updated',
    TEMPLATE_PUBLISHED: 'template.published',
    TEMPLATE_CLAUSE_LIBRARY_UPDATED: 'template.clauseLibraryUpdated',
    APPROVAL_REQUESTED: 'approval.requested',
    APPROVAL_GRANTED: 'approval.granted',
    APPROVAL_REJECTED: 'approval.rejected',
    NEGOTIATION_REVISION_REQUESTED: 'negotiation.revisionRequested',
    NEGOTIATION_ROLE_ASSIGNED: 'negotiation.roleAssigned',
    ESIGNATURE_REQUESTED: 'esignature.requested',
    ESIGNATURE_SENT: 'esignature.sent',
    ESIGNATURE_COMPLETED: 'esignature.completed',
    ESIGNATURE_DECLINED: 'esignature.declined',
    ESIGNATURE_EXPIRED: 'esignature.expired',
    ACCESS_GRANTED: 'access.granted',
    ACCESS_REVOKED: 'access.revoked',
    COLLABORATION_PARTICIPANT_INVITED: 'collaboration.participantInvited',
    COLLABORATION_COMMENT_ADDED: 'collaboration.commentAdded',
    COLLABORATION_SESSION_STARTED: 'collaboration.sessionStarted',
    COMPLIANCE_REPORT_GENERATED: 'complianceReport.generated',
    COMPLIANCE_REPORT_EXPORTED: 'complianceReport.exported',
    ANALYTICS_METRIC_UPDATED: 'analytics.metricUpdated',
    ANALYTICS_REPORT_GENERATED: 'analytics.reportGenerated',
    REMINDER_SCHEDULED: 'reminder.scheduled',
    REMINDER_SENT: 'reminder.sent',
    NOTIFICATION_DISPATCHED: 'notification.dispatched',
    INTEGRATION_SYNC_REQUESTED: 'integration.syncRequested',
    INTEGRATION_SYNC_COMPLETED: 'integration.syncCompleted',
    INTEGRATION_SYNC_FAILED: 'integration.syncFailed',
} as const;

export interface DomainEventPayloadMap {
    [DOMAIN_EVENTS.CONTRACT_CREATED]: { contractId: string; tenantId: string; templateId: string | null; createdBy: string };
    [DOMAIN_EVENTS.CONTRACT_UPDATED]: { contractId: string; tenantId: string; updatedBy: string };
    [DOMAIN_EVENTS.CONTRACT_VERSION_CREATED]: { contractId: string; tenantId: string; versionId: string; createdBy: string };
    [DOMAIN_EVENTS.CONTRACT_STATUS_CHANGED]: { contractId: string; tenantId: string; previousStatus: string; newStatus: string };
    [DOMAIN_EVENTS.CONTRACT_SUBMITTED_FOR_APPROVAL]: { contractId: string; tenantId: string; submittedBy: string };
    [DOMAIN_EVENTS.CONTRACT_ARCHIVED]: { contractId: string; tenantId: string };
    [DOMAIN_EVENTS.CONTRACT_DELETED]: { contractId: string; tenantId: string };

    [DOMAIN_EVENTS.TEMPLATE_CREATED]: { templateId: string; tenantId: string; createdBy: string };
    [DOMAIN_EVENTS.TEMPLATE_UPDATED]: { templateId: string; tenantId: string; updatedBy: string };
    [DOMAIN_EVENTS.TEMPLATE_PUBLISHED]: { templateId: string; tenantId: string };
    [DOMAIN_EVENTS.TEMPLATE_CLAUSE_LIBRARY_UPDATED]: { templateId: string; tenantId: string; clauseId: string };

    [DOMAIN_EVENTS.APPROVAL_REQUESTED]: { contractId: string; tenantId: string; approverId: string };
    [DOMAIN_EVENTS.APPROVAL_GRANTED]: { contractId: string; tenantId: string; approverId: string };
    [DOMAIN_EVENTS.APPROVAL_REJECTED]: { contractId: string; tenantId: string; approverId: string; reason: string };
    [DOMAIN_EVENTS.NEGOTIATION_REVISION_REQUESTED]: { contractId: string; tenantId: string; requestedBy: string; comment: string };
    [DOMAIN_EVENTS.NEGOTIATION_ROLE_ASSIGNED]: { contractId: string; tenantId: string; userId: string; role: 'owner' | 'reviewer' | 'approver' };

    [DOMAIN_EVENTS.ESIGNATURE_REQUESTED]: { contractId: string; tenantId: string; envelopeId: string; provider: 'docusign' | 'adobe_sign' };
    [DOMAIN_EVENTS.ESIGNATURE_SENT]: { contractId: string; tenantId: string; envelopeId: string; recipientEmail: string };
    [DOMAIN_EVENTS.ESIGNATURE_COMPLETED]: { contractId: string; tenantId: string; envelopeId: string; completedAt: Date };
    [DOMAIN_EVENTS.ESIGNATURE_DECLINED]: { contractId: string; tenantId: string; envelopeId: string; reason: string };
    [DOMAIN_EVENTS.ESIGNATURE_EXPIRED]: { contractId: string; tenantId: string; envelopeId: string };

    [DOMAIN_EVENTS.ACCESS_GRANTED]: { contractId: string; tenantId: string; userId: string; permission: 'view' | 'edit' | 'comment' };
    [DOMAIN_EVENTS.ACCESS_REVOKED]: { contractId: string; tenantId: string; userId: string };
    [DOMAIN_EVENTS.COLLABORATION_PARTICIPANT_INVITED]: { contractId: string; tenantId: string; invitedEmail: string; invitedBy: string };
    [DOMAIN_EVENTS.COLLABORATION_COMMENT_ADDED]: { contractId: string; tenantId: string; commentId: string; authorId: string };
    [DOMAIN_EVENTS.COLLABORATION_SESSION_STARTED]: { contractId: string; tenantId: string; userId: string };

    [DOMAIN_EVENTS.COMPLIANCE_REPORT_GENERATED]: { reportId: string; tenantId: string; contractId: string | null; generatedBy: string };
    [DOMAIN_EVENTS.COMPLIANCE_REPORT_EXPORTED]: { reportId: string; tenantId: string; format: 'pdf' | 'csv' };

    [DOMAIN_EVENTS.ANALYTICS_METRIC_UPDATED]: { tenantId: string; metric: string; value: number };
    [DOMAIN_EVENTS.ANALYTICS_REPORT_GENERATED]: { tenantId: string; reportId: string };

    [DOMAIN_EVENTS.REMINDER_SCHEDULED]: { tenantId: string; contractId: string; reminderType: string; scheduledFor: Date };
    [DOMAIN_EVENTS.REMINDER_SENT]: { tenantId: string; contractId: string; reminderType: string };
    [DOMAIN_EVENTS.NOTIFICATION_DISPATCHED]: { tenantId: string; userId: string; channel: 'email' | 'in-app'; template: string };

    [DOMAIN_EVENTS.INTEGRATION_SYNC_REQUESTED]: { tenantId: string; integration: 'salesforce' | 'hubspot' | 'google-drive' | 'ms365'; contractId: string | null };
    [DOMAIN_EVENTS.INTEGRATION_SYNC_COMPLETED]: { tenantId: string; integration: string; contractId: string | null };
    [DOMAIN_EVENTS.INTEGRATION_SYNC_FAILED]: { tenantId: string; integration: string; reason: string };
}

