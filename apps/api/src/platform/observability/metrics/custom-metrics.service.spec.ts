import { metrics } from '@opentelemetry/api';
import { CustomMetricsService } from './custom-metrics.service';

jest.mock('@opentelemetry/api', () => ({
  metrics: { getMeter: jest.fn() },
}));

describe('CustomMetricsService', () => {
  let createCounter: jest.Mock;
  let counterAdd: jest.Mock;
  let service: CustomMetricsService;

  beforeEach(() => {
    counterAdd = jest.fn();
    createCounter = jest.fn().mockReturnValue({ add: counterAdd });
    (metrics.getMeter as jest.Mock).mockReturnValue({ createCounter });

    service = new CustomMetricsService();
  });

  it('creates a counter on first use and adds the given value', () => {
    service.incrementCounter('contracts.created', 3, { plan: 'pro' });

    expect(createCounter).toHaveBeenCalledWith('contracts.created');
    expect(counterAdd).toHaveBeenCalledWith(3, { plan: 'pro' });
  });

  it('defaults the increment value to 1 when not given', () => {
    service.incrementCounter('contracts.created');

    expect(counterAdd).toHaveBeenCalledWith(1, undefined);
  });

  it('reuses the same counter instance across calls with the same name', () => {
    service.incrementCounter('contracts.created');
    service.incrementCounter('contracts.created');
    service.incrementCounter('contracts.created');

    expect(createCounter).toHaveBeenCalledTimes(1);
    expect(counterAdd).toHaveBeenCalledTimes(3);
  });

  it('creates a separate counter for each distinct metric name', () => {
    service.incrementCounter('contracts.created');
    service.incrementCounter('esignature.sent');

    expect(createCounter).toHaveBeenCalledTimes(2);
    expect(createCounter).toHaveBeenCalledWith('contracts.created');
    expect(createCounter).toHaveBeenCalledWith('esignature.sent');
  });
});
