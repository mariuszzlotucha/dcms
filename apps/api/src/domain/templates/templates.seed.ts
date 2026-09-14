import type { TemplateCategory, TemplateField } from '@contracts/template.schema';

export interface TemplateSeed {
  name: string;
  description: string;
  category: TemplateCategory;
  fields: TemplateField[];
}

export const SYSTEM_SEED_ACTOR = 'system';

export const PREMIUM_TEMPLATES_FLAG = 'premium_templates';

// Seeded for every tenant on `tenant.created` (architecture doc 1.2 / 3) so a
// new tenant has a usable library on day one, not an empty CRUD screen.
export const STARTER_TEMPLATES: TemplateSeed[] = [
  {
    name: 'Mutual Non-Disclosure Agreement',
    description: 'Standard two-way NDA for exploratory business discussions.',
    category: 'nda',
    fields: [
      { key: 'counterpartyName', label: 'Counterparty name', type: 'text', required: true },
      { key: 'effectiveDate', label: 'Effective date', type: 'date', required: true },
      { key: 'termMonths', label: 'Confidentiality term (months)', type: 'number', required: true },
    ],
  },
  {
    name: 'Service Agreement',
    description: 'General-purpose services contract for SME/freelancer engagements.',
    category: 'service_agreement',
    fields: [
      { key: 'clientName', label: 'Client name', type: 'text', required: true },
      { key: 'startDate', label: 'Start date', type: 'date', required: true },
      { key: 'feeAmount', label: 'Fee amount', type: 'number', required: true },
      { key: 'autoRenew', label: 'Auto-renews', type: 'boolean', required: false },
    ],
  },
];

// Unlocked per tenant when the `premium_templates` feature flag is toggled
// on (architecture doc 1.2 / 3: "unlocks premium/industry templates").
export const PREMIUM_TEMPLATES: TemplateSeed[] = [
  {
    name: 'Employment Offer Letter',
    description: 'Industry-specific employment offer with compensation and benefits fields.',
    category: 'employment',
    fields: [
      { key: 'employeeName', label: 'Employee name', type: 'text', required: true },
      { key: 'jobTitle', label: 'Job title', type: 'text', required: true },
      { key: 'startDate', label: 'Start date', type: 'date', required: true },
      { key: 'annualSalary', label: 'Annual salary', type: 'number', required: true },
    ],
  },
];
