import { Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EVENTS, EventPayloadMap } from '@';
import type { ComplianceReportFormat } from '@contracts/compliance-reporting.schema';
import { ComplianceReport } from './entities/compliance-report.entity';
import { ComplianceTrailEntry } from './entities/compliance-trail-entry.entity';

export interface ComplianceReportExport {
  report: ComplianceReport;
  content: string;
}

@Injectable()
export class ComplianceReportingService {
  constructor(
    @InjectRepository(ComplianceTrailEntry)
    private readonly trailEntries: Repository<ComplianceTrailEntry>,
    @InjectRepository(ComplianceReport)
    private readonly reports: Repository<ComplianceReport>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async recordEvent(tenantId: string, contractId: string, eventName: string, payload: unknown): Promise<void> {
    await this.trailEntries.save(
      this.trailEntries.create({ tenantId, contractId, eventName, payload, recordedAt: new Date() }),
    );
  }

  async generateReport(tenantId: string, contractId: string | null, generatedBy: string): Promise<ComplianceReport> {
    const entries = await this.trailEntries.find({
      where: contractId ? { tenantId, contractId } : { tenantId },
      order: { recordedAt: 'ASC' },
    });

    const report = await this.reports.save(
      this.reports.create({ tenantId, contractId, generatedBy, entries, exportedFormat: null, exportedAt: null }),
    );

    this.eventEmitter.emit(
      EVENTS.COMPLIANCE_REPORT_GENERATED,
      {
        reportId: report.id,
        tenantId,
        contractId,
        generatedBy,
      } satisfies EventPayloadMap[typeof EVENTS.COMPLIANCE_REPORT_GENERATED],
    );

    return report;
  }

  // Only CSV is real. A plain-text stand-in dressed up as a PDF would
  // misrepresent what an auditor receives, and no PDF library is installed
  // yet — real audit-ready rendering (headers, pagination, signatures) is a
  // follow-up, not something to fake here.
  async exportReport(tenantId: string, reportId: string, format: ComplianceReportFormat): Promise<ComplianceReportExport> {
    const report = await this.getReport(tenantId, reportId);

    if (format === 'pdf') {
      throw new NotImplementedException('PDF export is not yet implemented — use format: csv');
    }

    const content = this.toCsv(report);

    report.exportedFormat = format;
    report.exportedAt = new Date();
    const saved = await this.reports.save(report);

    this.eventEmitter.emit(
      EVENTS.COMPLIANCE_REPORT_EXPORTED,
      { reportId: saved.id, tenantId, format } satisfies EventPayloadMap[typeof EVENTS.COMPLIANCE_REPORT_EXPORTED],
    );

    return { report: saved, content };
  }

  async getReport(tenantId: string, reportId: string): Promise<ComplianceReport> {
    const report = await this.reports.findOne({ where: { id: reportId, tenantId } });

    if (!report) {
      throw new NotFoundException('Compliance report not found');
    }

    return report;
  }

  async listReports(tenantId: string): Promise<ComplianceReport[]> {
    return this.reports.find({ where: { tenantId }, order: { generatedAt: 'DESC' } });
  }

  private toCsv(report: ComplianceReport): string {
    const rows = (report.entries as ComplianceTrailEntry[]).map((entry) =>
      [entry.recordedAt, entry.eventName, entry.contractId, JSON.stringify(entry.payload)]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(','),
    );

    return ['recordedAt,eventName,contractId,payload', ...rows].join('\n');
  }
}
