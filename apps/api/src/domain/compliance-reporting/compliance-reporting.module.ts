import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComplianceReport } from './entities/compliance-report.entity';
import { ComplianceTrailEntry } from './entities/compliance-trail-entry.entity';
import { ComplianceReportingController } from './compliance-reporting.controller';
import { ComplianceReportingListener } from './compliance-reporting.listener';
import { ComplianceReportingService } from './compliance-reporting.service';

@Module({
  imports: [TypeOrmModule.forFeature([ComplianceTrailEntry, ComplianceReport])],
  controllers: [ComplianceReportingController],
  providers: [ComplianceReportingService, ComplianceReportingListener],
  exports: [ComplianceReportingService],
})
export class ComplianceReportingModule {}
