import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsReport } from './entities/analytics-report.entity';
import { NegotiationTiming } from './entities/negotiation-timing.entity';
import { TenantMetric } from './entities/tenant-metric.entity';
import { AnalyticsInsightsController } from './analytics-insights.controller';
import { AnalyticsInsightsListener } from './analytics-insights.listener';
import { AnalyticsInsightsService } from './analytics-insights.service';

@Module({
  imports: [TypeOrmModule.forFeature([TenantMetric, NegotiationTiming, AnalyticsReport])],
  controllers: [AnalyticsInsightsController],
  providers: [AnalyticsInsightsService, AnalyticsInsightsListener],
  exports: [AnalyticsInsightsService],
})
export class AnalyticsInsightsModule {}
