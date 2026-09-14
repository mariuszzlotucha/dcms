import { Request } from 'express';
import { AnalyticsInsightsController } from './analytics-insights.controller';
import { AnalyticsInsightsService } from './analytics-insights.service';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';

describe('AnalyticsInsightsController', () => {
  let service: { getDashboard: jest.Mock; generateReport: jest.Mock; listReports: jest.Mock };
  let tenantContext: { getTenantId: jest.Mock };
  let controller: AnalyticsInsightsController;

  const requestAs = (userId: string): Request => ({ user: { userId } }) as unknown as Request;

  beforeEach(() => {
    service = { getDashboard: jest.fn(), generateReport: jest.fn(), listReports: jest.fn() };
    tenantContext = { getTenantId: jest.fn().mockResolvedValue('t1') };
    controller = new AnalyticsInsightsController(
      service as unknown as AnalyticsInsightsService,
      tenantContext as unknown as TenantContextService,
    );
  });

  it('gets the dashboard scoped to the resolved tenant', async () => {
    service.getDashboard.mockResolvedValue([]);

    await controller.getDashboard();

    expect(service.getDashboard).toHaveBeenCalledWith('t1');
  });

  it('generates a report scoped to the resolved tenant and authenticated caller', async () => {
    service.generateReport.mockResolvedValue({ id: 'report-1' });

    await controller.generateReport(requestAs('u1'));

    expect(service.generateReport).toHaveBeenCalledWith('t1', 'u1');
  });

  it('lists reports scoped to the resolved tenant', async () => {
    service.listReports.mockResolvedValue([]);

    await controller.listReports();

    expect(service.listReports).toHaveBeenCalledWith('t1');
  });
});
