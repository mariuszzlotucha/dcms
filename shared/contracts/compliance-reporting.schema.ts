import { z } from 'zod';

// Single source of truth for the `compliance-reporting` domain module's
// request/response shapes. See docs/dcms-domain-architecture.md 1.6 and
// .claude/rules/domain-backend.md (v1.5, deferred until v1 is stable).
export const complianceReportFormatSchema = z.enum(['pdf', 'csv']);
export type ComplianceReportFormat = z.infer<typeof complianceReportFormatSchema>;

export const generateComplianceReportSchema = z.object({
  // Omitted = a tenant-wide report across every contract's trail.
  contractId: z.string().uuid().optional(),
});
export type GenerateComplianceReportDto = z.infer<typeof generateComplianceReportSchema>;

export const exportComplianceReportSchema = z.object({
  format: complianceReportFormatSchema,
});
export type ExportComplianceReportDto = z.infer<typeof exportComplianceReportSchema>;
