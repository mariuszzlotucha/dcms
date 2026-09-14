import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EVENTS, EventPayloadMap } from '@';
import type {
  AddTemplateClauseDto,
  CreateTemplateDto,
  TemplateCategory,
  TemplateStatus,
  UpdateTemplateClauseDto,
  UpdateTemplateDto,
} from '@contracts/template.schema';
import { TemplateClause } from './entities/template-clause.entity';
import { Template } from './entities/template.entity';
import {
  PREMIUM_TEMPLATES,
  STARTER_TEMPLATES,
  SYSTEM_SEED_ACTOR,
  TemplateSeed,
} from './templates.seed';

export interface ListTemplatesFilter {
  category?: TemplateCategory;
  status?: TemplateStatus;
}

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(Template)
    private readonly templates: Repository<Template>,
    @InjectRepository(TemplateClause)
    private readonly clauses: Repository<TemplateClause>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createTemplate(
    tenantId: string,
    createdBy: string,
    dto: CreateTemplateDto,
  ): Promise<Template> {
    return this.insertTemplate(tenantId, createdBy, dto, false);
  }

  async updateTemplate(
    tenantId: string,
    templateId: string,
    updatedBy: string,
    dto: UpdateTemplateDto,
  ): Promise<Template> {
    const template = await this.getTemplate(tenantId, templateId);

    Object.assign(template, dto);
    const saved = await this.templates.save(template);

    this.eventEmitter.emit(EVENTS.TEMPLATE_UPDATED, {
      templateId: saved.id,
      tenantId,
      updatedBy,
    } satisfies EventPayloadMap[typeof EVENTS.TEMPLATE_UPDATED]);

    return saved;
  }

  async publishTemplate(tenantId: string, templateId: string): Promise<Template> {
    const template = await this.getTemplate(tenantId, templateId);

    if (template.status === 'published') {
      throw new BadRequestException('Template is already published');
    }

    template.status = 'published';
    const saved = await this.templates.save(template);

    this.eventEmitter.emit(EVENTS.TEMPLATE_PUBLISHED, {
      templateId: saved.id,
      tenantId,
    } satisfies EventPayloadMap[typeof EVENTS.TEMPLATE_PUBLISHED]);

    return saved;
  }

  async getTemplate(tenantId: string, templateId: string): Promise<Template> {
    const template = await this.templates.findOne({ where: { id: templateId, tenantId } });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async listTemplates(tenantId: string, filter: ListTemplatesFilter = {}): Promise<Template[]> {
    return this.templates.find({ where: { tenantId, ...filter } });
  }

  async listClauses(tenantId: string, templateId: string): Promise<TemplateClause[]> {
    await this.getTemplate(tenantId, templateId);
    return this.clauses.find({ where: { tenantId, templateId }, order: { order: 'ASC' } });
  }

  async addClause(
    tenantId: string,
    templateId: string,
    dto: AddTemplateClauseDto,
  ): Promise<TemplateClause> {
    await this.getTemplate(tenantId, templateId);

    const clause = await this.clauses.save(
      this.clauses.create({
        tenantId,
        templateId,
        title: dto.title,
        body: dto.body,
        order: dto.order ?? 0,
      }),
    );

    this.emitClauseLibraryUpdated(tenantId, templateId, clause.id);

    return clause;
  }

  async updateClause(
    tenantId: string,
    templateId: string,
    clauseId: string,
    dto: UpdateTemplateClauseDto,
  ): Promise<TemplateClause> {
    const clause = await this.getClause(tenantId, templateId, clauseId);

    Object.assign(clause, dto);
    const saved = await this.clauses.save(clause);

    this.emitClauseLibraryUpdated(tenantId, templateId, saved.id);

    return saved;
  }

  async removeClause(tenantId: string, templateId: string, clauseId: string): Promise<void> {
    const clause = await this.getClause(tenantId, templateId, clauseId);

    await this.clauses.remove(clause);

    this.emitClauseLibraryUpdated(tenantId, templateId, clauseId);
  }

  // Idempotent: skips tenants that already have starter templates (e.g. a
  // replayed tenant.created event) rather than double-seeding the library.
  async seedStarterTemplates(tenantId: string): Promise<void> {
    await this.seedIfMissing(tenantId, STARTER_TEMPLATES, false);
  }

  async seedPremiumTemplates(tenantId: string): Promise<void> {
    await this.seedIfMissing(tenantId, PREMIUM_TEMPLATES, true);
  }

  private async seedIfMissing(
    tenantId: string,
    seeds: TemplateSeed[],
    isPremium: boolean,
  ): Promise<void> {
    const existing = await this.templates.find({ where: { tenantId, isPremium } });
    const existingNames = new Set(existing.map((t) => t.name));

    for (const seed of seeds) {
      if (existingNames.has(seed.name)) {
        continue;
      }

      await this.insertTemplate(
        tenantId,
        SYSTEM_SEED_ACTOR,
        {
          name: seed.name,
          description: seed.description,
          category: seed.category,
          fields: seed.fields,
        },
        isPremium,
      );
    }
  }

  private async insertTemplate(
    tenantId: string,
    createdBy: string,
    dto: CreateTemplateDto,
    isPremium: boolean,
  ): Promise<Template> {
    const template = await this.templates.save(
      this.templates.create({
        tenantId,
        createdBy,
        name: dto.name,
        description: dto.description ?? null,
        category: dto.category,
        fields: dto.fields,
        isPremium,
        status: 'draft',
      }),
    );

    this.eventEmitter.emit(EVENTS.TEMPLATE_CREATED, {
      templateId: template.id,
      tenantId,
      createdBy,
    } satisfies EventPayloadMap[typeof EVENTS.TEMPLATE_CREATED]);

    return template;
  }

  private async getClause(
    tenantId: string,
    templateId: string,
    clauseId: string,
  ): Promise<TemplateClause> {
    await this.getTemplate(tenantId, templateId);

    const clause = await this.clauses.findOne({ where: { id: clauseId, tenantId, templateId } });

    if (!clause) {
      throw new NotFoundException('Clause not found');
    }

    return clause;
  }

  private emitClauseLibraryUpdated(tenantId: string, templateId: string, clauseId: string): void {
    this.eventEmitter.emit(EVENTS.TEMPLATE_CLAUSE_LIBRARY_UPDATED, {
      templateId,
      tenantId,
      clauseId,
    } satisfies EventPayloadMap[typeof EVENTS.TEMPLATE_CLAUSE_LIBRARY_UPDATED]);
  }
}
