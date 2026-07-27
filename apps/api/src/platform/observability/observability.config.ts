export interface ObservabilityModuleConfig {
  serviceName: string;
  otlpEndpoint?: string;
  enabled: boolean;
}
