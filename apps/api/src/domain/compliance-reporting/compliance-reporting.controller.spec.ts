import { ComplianceReportingController } from './compliance-reporting.controller';
import { ComplianceReportingService } from './compliance-reporting.service';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';

describe('ComplianceReportingController', () => {
  let service: {
    generateReport: jest.Mock;
    listReports: jest.Mock;
    getReport: jest.Mock;
    exportReport: jest.Mock;
  };
  let tenantContext: { getTenantId: jest.Mock };
  let controller: ComplianceReportingController;

  beforeEach(() => {
    service = {
      generateReport: jest.fn(),
      listReports: jest.fn(),
      getReport: jest.fn(),
      exportReport: jest.fn(),
    };
    tenantContext = { getTenantId: jest.fn().mockResolvedValue('t1') };
    controller = new ComplianceReportingController(
      service as unknown as ComplianceReportingService,
      tenantContext as unknown as TenantContextService,
    );
  });

  it('generates a report scoped to the resolved tenant and requesting user', async () => {
    const request = { user: { userId: 'u1' } } as never;

    await controller.generateReport({ contractId: 'c1' }, request);

    expect(service.generateReport).toHaveBeenCalledWith('t1', 'c1', 'u1');
  });

  it('generates a tenant-wide report when no contractId is given', async () => {
    const request = { user: { userId: 'u1' } } as never;

    await controller.generateReport({}, request);

    expect(service.generateReport).toHaveBeenCalledWith('t1', null, 'u1');
  });

  it('lists reports scoped to the resolved tenant', async () => {
    service.listReports.mockResolvedValue([]);

    await controller.listReports();

    expect(service.listReports).toHaveBeenCalledWith('t1');
  });

  it('gets a single report scoped to the resolved tenant', async () => {
    await controller.getReport('report-1');

    expect(service.getReport).toHaveBeenCalledWith('t1', 'report-1');
  });

  it('exports a report in the requested format', async () => {
    await controller.exportReport('report-1', { format: 'csv' });

    expect(service.exportReport).toHaveBeenCalledWith('t1', 'report-1', 'csv');
  });
});
