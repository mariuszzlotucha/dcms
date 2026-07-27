import { Injectable } from '@nestjs/common';
import { Counter, metrics } from '@opentelemetry/api';

@Injectable()
export class CustomMetricsService {
  private readonly meter = metrics.getMeter('dcms');
  private readonly counters = new Map<string, Counter>();

  incrementCounter(name: string, value = 1, attributes?: Record<string, string | number | boolean>): void {
    this.getOrCreateCounter(name).add(value, attributes);
  }

  private getOrCreateCounter(name: string): Counter {
    const existing = this.counters.get(name);
    if (existing) {
      return existing;
    }

    const counter = this.meter.createCounter(name);
    this.counters.set(name, counter);
    return counter;
  }
}
