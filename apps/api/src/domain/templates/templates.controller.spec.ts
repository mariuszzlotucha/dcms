import { Request } from 'express';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';

describe('TemplatesController', () => {
  let templatesService: {
    createTemplate: jest.Mock;
    listTemplates: jest.Mock;
    getTemplate: jest.Mock;
    updateTemplate: jest.Mock;
    publishTemplate: jest.Mock;
  };
  let tenantContext: { getTenantId: jest.Mock };
  let controller: TemplatesController;

  const requestAs = (userId: string): Request => ({ user: { userId } }) as unknown as Request;

  beforeEach(() => {
    templatesService = {
      createTemplate: jest.fn(),
      listTemplates: jest.fn(),
      getTemplate: jest.fn(),
      updateTemplate: jest.fn(),
      publishTemplate: jest.fn(),
    };
    tenantContext = { getTenantId: jest.fn().mockResolvedValue('t1') };
    controller = new TemplatesController(
      templatesService as unknown as TemplatesService,
      tenantContext as unknown as TenantContextService,
    );
  });

  it('creates a template scoped to the resolved tenant and authenticated user', async () => {
    templatesService.createTemplate.mockResolvedValue({ id: 'tmpl-1' });

    const dto = { name: 'NDA', category: 'nda' as const, fields: [] };
    await controller.createTemplate(dto, requestAs('u1'));

    expect(templatesService.createTemplate).toHaveBeenCalledWith('t1', 'u1', dto);
  });

  it('lists templates scoped to the resolved tenant', async () => {
    templatesService.listTemplates.mockResolvedValue([]);

    await controller.listTemplates('nda', undefined);

    expect(templatesService.listTemplates).toHaveBeenCalledWith('t1', { category: 'nda', status: undefined });
  });

  it('fetches a single template scoped to the resolved tenant', async () => {
    templatesService.getTemplate.mockResolvedValue({ id: 'tmpl-1' });

    await controller.getTemplate('tmpl-1');

    expect(templatesService.getTemplate).toHaveBeenCalledWith('t1', 'tmpl-1');
  });

  it('publishes a template scoped to the resolved tenant', async () => {
    templatesService.publishTemplate.mockResolvedValue({ id: 'tmpl-1', status: 'published' });

    await controller.publishTemplate('tmpl-1');

    expect(templatesService.publishTemplate).toHaveBeenCalledWith('t1', 'tmpl-1');
  });
});
