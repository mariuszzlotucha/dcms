import { z } from 'zod';

// Single source of truth for the `templates` domain module's request/response
// shapes — consumed by apps/api (validation) and apps/web (typed client).
// See docs/dcms-domain-architecture.md 1.2 and .claude/rules/domain-backend.md.

export const templateCategorySchema = z.enum([
  'nda',
  'employment',
  'service_agreement',
  'sales',
  'custom',
]);
export type TemplateCategory = z.infer<typeof templateCategorySchema>;

export const templateFieldTypeSchema = z.enum(['text', 'number', 'date', 'boolean', 'select']);
export type TemplateFieldType = z.infer<typeof templateFieldTypeSchema>;

export const templateFieldSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'key must be a valid identifier'),
  label: z.string().min(1).max(200),
  type: templateFieldTypeSchema,
  required: z.boolean().default(false),
  options: z.array(z.string().min(1).max(200)).max(50).optional(),
});
export type TemplateField = z.infer<typeof templateFieldSchema>;

export const templateStatusSchema = z.enum(['draft', 'published']);
export type TemplateStatus = z.infer<typeof templateStatusSchema>;

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: templateCategorySchema,
  fields: z.array(templateFieldSchema).max(50).default([]),
});
export type CreateTemplateDto = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = createTemplateSchema.partial();
export type UpdateTemplateDto = z.infer<typeof updateTemplateSchema>;

export const addTemplateClauseSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(20_000),
  order: z.number().int().min(0).optional(),
});
export type AddTemplateClauseDto = z.infer<typeof addTemplateClauseSchema>;

export const updateTemplateClauseSchema = addTemplateClauseSchema.partial();
export type UpdateTemplateClauseDto = z.infer<typeof updateTemplateClauseSchema>;
