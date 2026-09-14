import { AnalyticsInsightsListener } from './analytics-insights.listener';
import { AnalyticsInsightsService } from './analytics-insights.service';

describe('AnalyticsInsightsListener', () => {
  let service: {
    recordContractStatusChanged: jest.Mock;
    recordEsignatureCompleted: jest.Mock;
    recordEsignatureExpired: jest.Mock;
    recordRevisionRequested: jest.Mock;
    recordBillingSubscriptionUpdated: jest.Mock;
  };
  let listener: AnalyticsInsightsListener;

  beforeEach(() => {
    service = {
      recordContractStatusChanged: jest.fn(),
      recordEsignatureCompleted: jest.fn(),
      recordEsignatureExpired: jest.fn(),
      recordRevisionRequested: jest.fn(),
      recordBillingSubscriptionUpdated: jest.fn(),
    };
    listener = new AnalyticsInsightsListener(service as unknown as AnalyticsInsightsService);
  });

  it('records a contract status change', async () => {
    await listener.handleContractStatusChanged({
      contractId: 'c1',
      tenantId: 't1',
      previousStatus: 'draft',
      newStatus: 'in_review',
    });

    expect(service.recordContractStatusChanged).toHaveBeenCalledWith(
      't1',
      'c1',
      'draft',
      'in_review',
    );
  });

  it('records esignature.completed', async () => {
    await listener.handleEsignatureCompleted({
      contractId: 'c1',
      tenantId: 't1',
      envelopeId: 'env-1',
      completedAt: new Date(),
    });

    expect(service.recordEsignatureCompleted).toHaveBeenCalledWith('t1');
  });

  it('records esignature.expired', async () => {
    await listener.handleEsignatureExpired({
      contractId: 'c1',
      tenantId: 't1',
      envelopeId: 'env-1',
    });

    expect(service.recordEsignatureExpired).toHaveBeenCalledWith('t1');
  });

  it('records negotiation.revisionRequested', async () => {
    await listener.handleNegotiationRevisionRequested({
      contractId: 'c1',
      tenantId: 't1',
      requestedBy: 'u1',
      comment: 'please fix',
    });

    expect(service.recordRevisionRequested).toHaveBeenCalledWith('t1');
  });

  it('records billing.subscription.updated', async () => {
    await listener.handleBillingSubscriptionUpdated({
      tenantId: 't1',
      plan: 'pro',
      status: 'active',
    });

    expect(service.recordBillingSubscriptionUpdated).toHaveBeenCalledWith('t1');
  });
});
