import { NotFoundException, NotImplementedException } from '@nestjs/common';
import { ComplianceReportingService } from './compliance-reporting.service';
import { ComplianceReport } from './entities/compliance-report.entity';

describe('ComplianceReportingService', () => {
  let trailEntries: { find: jest.Mock; create: jest.Mock; save: jest.Mock };
  let reports: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let service: ComplianceReportingService;

  beforeEach(() => {
    trailEntries = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => ({ id: 'entry-1', ...data })),
    };
    reports = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => data as ComplianceReport),
      save: jest.fn(async (data) => ({ id: 'report-1', ...data }) as ComplianceReport),
    };
    eventEmitter = { emit: jest.fn() };

    service = new ComplianceReportingService(trailEntries as never, reports as never, eventEmitter as never);
  });

  describe('recordEvent', () => {
    it('persists a trail entry for the tenant/contract/event', async () => {
      await service.recordEvent('t1', 'c1', 'contract.created', { foo: 'bar' });

      expect(trailEntries.save).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 't1', contractId: 'c1', eventName: 'contract.created', payload: { foo: 'bar' } }),
      );
    });
  });

  describe('generateReport', () => {
    it('scopes the snapshot to one contract when a contractId is given', async () => {
      await service.generateReport('t1', 'c1', 'u1');

      expect(trailEntries.find).toHaveBeenCalledWith({ where: { tenantId: 't1', contractId: 'c1' }, order: { recordedAt: 'ASC' } });
      expect(reports.save).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 't1', contractId: 'c1', generatedBy: 'u1' }));
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'complianceReport.generated',
        expect.objectContaining({ tenantId: 't1', contractId: 'c1', generatedBy: 'u1' }),
      );
    });

    it('produces a tenant-wide report when no contractId is given', async () => {
      await service.generateReport('t1', null, 'u1');

      expect(trailEntries.find).toHaveBeenCalledWith({ where: { tenantId: 't1' }, order: { recordedAt: 'ASC' } });
      expect(reports.save).toHaveBeenCalledWith(expect.objectContaining({ contractId: null }));
    });
  });

  describe('getReport', () => {
    it('returns the report when it belongs to the tenant', async () => {
      const report = { id: 'report-1', tenantId: 't1' } as ComplianceReport;
      reports.findOne.mockResolvedValue(report);

      await expect(service.getReport('t1', 'report-1')).resolves.toBe(report);
      expect(reports.findOne).toHaveBeenCalledWith({ where: { id: 'report-1', tenantId: 't1' } });
    });

    it('throws NotFound when the report does not belong to the tenant', async () => {
      reports.findOne.mockResolvedValue(null);

      await expect(service.getReport('t1', 'other-tenant-report')).rejects.toThrow(NotFoundException);
    });
  });

  describe('exportReport', () => {
    it('throws when the report does not exist for the tenant', async () => {
      await expect(service.exportReport('t1', 'missing', 'csv')).rejects.toThrow(NotFoundException);
    });

    it('rejects pdf as not yet implemented', async () => {
      reports.findOne.mockResolvedValue({ id: 'report-1', tenantId: 't1', entries: [] });

      await expect(service.exportReport('t1', 'report-1', 'pdf')).rejects.toThrow(NotImplementedException);
      expect(reports.save).not.toHaveBeenCalled();
    });

    it('renders csv content and marks the report exported', async () => {
      reports.findOne.mockResolvedValue({
        id: 'report-1',
        tenantId: 't1',
        entries: [{ recordedAt: new Date('2026-01-01T00:00:00Z'), eventName: 'contract.created', contractId: 'c1', payload: { a: 1 } }],
      });

      const result = await service.exportReport('t1', 'report-1', 'csv');

      expect(result.content).toContain('recordedAt,eventName,contractId,payload');
      expect(result.content).toContain('contract.created');
      expect(reports.save).toHaveBeenCalledWith(expect.objectContaining({ exportedFormat: 'csv', exportedAt: expect.any(Date) }));
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'complianceReport.exported',
        expect.objectContaining({ reportId: 'report-1', tenantId: 't1', format: 'csv' }),
      );
    });

    it('escapes embedded double quotes in CSV field values so the row stays parseable', async () => {
      const payload = { name: 'Acme "Big Deal" Corp' };
      reports.findOne.mockResolvedValue({
        id: 'report-1',
        tenantId: 't1',
        entries: [
          {
            recordedAt: new Date('2026-01-01T00:00:00Z'),
            eventName: 'contract.created',
            contractId: 'c1',
            payload,
          },
        ],
      });

      const result = await service.exportReport('t1', 'report-1', 'csv');

      // Every double quote in the field (including those from JSON.stringify
      // escaping the value's own embedded quotes) must come out doubled, per
      // CSV quoting rules, or the row would fail to parse back correctly.
      const payloadField = JSON.stringify(payload).replace(/"/g, '""');
      expect(result.content).toContain(payloadField);
    });

    it('produces a header-only CSV for a report with no trail entries', async () => {
      reports.findOne.mockResolvedValue({ id: 'report-1', tenantId: 't1', entries: [] });

      const result = await service.exportReport('t1', 'report-1', 'csv');

      expect(result.content).toBe('recordedAt,eventName,contractId,payload');
    });
  });

  describe('listReports', () => {
    it('lists reports scoped to the tenant, newest first', async () => {
      await service.listReports('t1');

      expect(reports.find).toHaveBeenCalledWith({ where: { tenantId: 't1' }, order: { generatedAt: 'DESC' } });
    });
  });
});
