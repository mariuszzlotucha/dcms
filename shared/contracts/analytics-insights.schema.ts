import { z } from 'zod';

// Single source of truth for the `analytics-insights` domain module's
// response shapes. See docs/dcms-domain-architecture.md 1.7 and
// .claude/rules/domain-backend.md. No request DTOs: the dashboard is
// read-only and report generation takes no body — both are driven entirely
// by the resolved tenant + caller identity.
export const tenantMetricSchema = z.object({
  metric: z.string(),
  value: z.number(),
});
export type TenantMetricDto = z.infer<typeof tenantMetricSchema>;

// "basic" is included in every plan; "advanced" is a paid add-on gated by
// the 'advanced_analytics' feature flag (dcms-domain-architecture.md v1
// monetization note) — not by usage.limitExceeded, since it's a plan-tier
// gate, not a consumption limit.
export const analyticsReportTierSchema = z.enum(['basic', 'advanced']);
export type AnalyticsReportTier = z.infer<typeof analyticsReportTierSchema>;
