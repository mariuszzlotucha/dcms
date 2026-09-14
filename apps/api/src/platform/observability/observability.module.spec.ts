import { NodeSDK } from '@opentelemetry/sdk-node';
import { initializeObservability } from './observability.module';

jest.mock('@opentelemetry/auto-instrumentations-node');
jest.mock('@opentelemetry/exporter-metrics-otlp-http');
jest.mock('@opentelemetry/exporter-trace-otlp-http');
jest.mock('@opentelemetry/resources');
jest.mock('@opentelemetry/sdk-metrics');
jest.mock('@opentelemetry/sdk-node');

describe('initializeObservability', () => {
  const MockedNodeSDK = NodeSDK as jest.MockedClass<typeof NodeSDK>;
  let sdkStart: jest.Mock;

  beforeEach(() => {
    sdkStart = jest.fn();
    MockedNodeSDK.mockImplementation(
      () => ({ start: sdkStart, shutdown: jest.fn().mockResolvedValue(undefined) }) as unknown as NodeSDK,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('does not start the SDK when disabled, even with an endpoint configured', () => {
    initializeObservability({ serviceName: 'dcms-api', otlpEndpoint: 'https://otel.example', enabled: false });

    expect(MockedNodeSDK).not.toHaveBeenCalled();
  });

  it('does not start the SDK when enabled but no OTLP endpoint is configured', () => {
    initializeObservability({ serviceName: 'dcms-api', enabled: true });

    expect(MockedNodeSDK).not.toHaveBeenCalled();
  });

  it('starts the SDK when enabled with an OTLP endpoint', () => {
    initializeObservability({ serviceName: 'dcms-api', otlpEndpoint: 'https://otel.example', enabled: true });

    expect(MockedNodeSDK).toHaveBeenCalledTimes(1);
    expect(sdkStart).toHaveBeenCalledTimes(1);
  });
});
