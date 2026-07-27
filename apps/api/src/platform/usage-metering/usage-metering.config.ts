export interface UsageMeteringModuleConfig {
  limitsByPlan: Record<string, Record<string, number>>;
}

export const USAGE_METERING_MODULE_CONFIG = 'USAGE_METERING_MODULE_CONFIG';
