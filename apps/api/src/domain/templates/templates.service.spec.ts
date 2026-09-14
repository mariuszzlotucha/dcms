import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { Template } from './entities/template.entity';
import { TemplateClause } from './entities/template-clause.entity';

describe('TemplatesService', () => {
  let templates: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let clauses: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  let eventEmitter: { emit: jest.Mock };
  let service: TemplatesService;

  beforeEach(() => {
    templates = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => data as Template),
      save: jest.fn(async (data) => ({ id: 'tmpl-1', ...data }) as Template),
    };
    clauses = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => data as TemplateClause),
      save: jest.fn(async (data) => ({ id: 'clause-1', ...data }) as TemplateClause),
      remove: jest.fn(),
    };
    eventEmitter = { emit: jest.fn() };

    service = new TemplatesService(
      templates as never,
      clauses as never,
      eventEmitter as never,
    );
  });

  describe('createTemplate', () => {
    it('creates a draft template scoped to the tenant and emits template.created', async () => {
      const result = await service.createTemplate('t1', 'u1', {
        name: 'NDA',
        category: 'nda',
        fields: [],
      });

      expect(templates.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 't1', createdBy: 'u1', status: 'draft', isPremium: false }),
      );
      expect(result.id).toBe('tmpl-1');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'template.created',
        expect.objectContaining({ templateId: 'tmpl-1', tenantId: 't1', createdBy: 'u1' }),
      );
    });
  });

  describe('getTemplate', () => {
    it('throws NotFound when the template does not belong to the tenant', async () => {
      templates.findOne.mockResolvedValue(null);

      await expect(service.getTemplate('t1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
      expect(templates.findOne).toHaveBeenCalledWith({ where: { id: 'missing', tenantId: 't1' } });
    });
  });

  describe('publishTemplate', () => {
    it('flips a draft template to published and emits template.published', async () => {
      templates.findOne.mockResolvedValue({ id: 'tmpl-1', tenantId: 't1', status: 'draft' });

      const result = await service.publishTemplate('t1', 'tmpl-1');

      expect(result.status).toBe('published');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'template.published',
        expect.objectContaining({ templateId: 'tmpl-1', tenantId: 't1' }),
      );
    });

    it('rejects publishing an already-published template', async () => {
      templates.findOne.mockResolvedValue({ id: 'tmpl-1', tenantId: 't1', status: 'published' });

      await expect(service.publishTemplate('t1', 'tmpl-1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('clause library', () => {
    it('adds a clause and emits template.clauseLibraryUpdated', async () => {
      templates.findOne.mockResolvedValue({ id: 'tmpl-1', tenantId: 't1' });

      const result = await service.addClause('t1', 'tmpl-1', { title: 'Confidentiality', body: 'text' });

      expect(result.id).toBe('clause-1');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'template.clauseLibraryUpdated',
        expect.objectContaining({ templateId: 'tmpl-1', tenantId: 't1', clauseId: 'clause-1' }),
      );
    });

    it('throws NotFound when adding a clause to a template outside the tenant', async () => {
      templates.findOne.mockResolvedValue(null);

      await expect(
        service.addClause('t1', 'other-tenant-template', { title: 'x', body: 'y' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('removes a clause and emits template.clauseLibraryUpdated', async () => {
      templates.findOne.mockResolvedValue({ id: 'tmpl-1', tenantId: 't1' });
      clauses.findOne.mockResolvedValue({ id: 'clause-1', tenantId: 't1', templateId: 'tmpl-1' });

      await service.removeClause('t1', 'tmpl-1', 'clause-1');

      expect(clauses.remove).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'template.clauseLibraryUpdated',
        expect.objectContaining({ clauseId: 'clause-1' }),
      );
    });
  });

  describe('seedStarterTemplates', () => {
    it('seeds the starter catalog for a new tenant', async () => {
      templates.find.mockResolvedValue([]);

      await service.seedStarterTemplates('t1');

      expect(templates.find).toHaveBeenCalledWith({ where: { tenantId: 't1', isPremium: false } });
      expect(templates.save).toHaveBeenCalledTimes(2); // STARTER_TEMPLATES catalog size
    });

    it('does not re-seed templates that already exist for the tenant', async () => {
      templates.find.mockResolvedValue([{ name: 'Mutual Non-Disclosure Agreement' }, { name: 'Service Agreement' }]);

      await service.seedStarterTemplates('t1');

      expect(templates.save).not.toHaveBeenCalled();
    });
  });

  describe('seedPremiumTemplates', () => {
    it('seeds the premium catalog flagged as isPremium', async () => {
      templates.find.mockResolvedValue([]);

      await service.seedPremiumTemplates('t1');

      expect(templates.find).toHaveBeenCalledWith({ where: { tenantId: 't1', isPremium: true } });
      expect(templates.create).toHaveBeenCalledWith(expect.objectContaining({ isPremium: true }));
    });
  });
});
