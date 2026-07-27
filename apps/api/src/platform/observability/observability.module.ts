import { Module } from '@nestjs/common';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { ObservabilityModuleConfig } from './observability.config';
import { CustomMetricsService } from './metrics/custom-metrics.service';

export function initializeObservability(config: ObservabilityModuleConfig): void {
  if (!config.enabled || !config.otlpEndpoint) {
    return;
  }

  const sdk = new NodeSDK({
    resource: new Resource({ [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName }),
    traceExporter: new OTLPTraceExporter({ url: `${config.otlpEndpoint}/v1/traces` }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${config.otlpEndpoint}/v1/metrics` }),
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();

  process.on('SIGTERM', () => {
    void sdk.shutdown().finally(() => process.exit(0));
  });
}

@Module({
  providers: [CustomMetricsService],
  exports: [CustomMetricsService],
})
export class ObservabilityModule {}
