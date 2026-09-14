import { ComplianceReportingListener } from './compliance-reporting.listener';
import { ComplianceReportingService } from './compliance-reporting.service';

describe('ComplianceReportingListener', () => {
  let service: { recordEvent: jest.Mock };
  let eventEmitter: { onAny: jest.Mock };
  let listener: ComplianceReportingListener;

  beforeEach(() => {
    service = { recordEvent: jest.fn() };
    eventEmitter = { onAny: jest.fn() };
    listener = new ComplianceReportingListener(
      eventEmitter as never,
      service as unknown as ComplianceReportingService,
    );
  });

  it('subscribes via onAny on module init', () => {
    listener.onModuleInit();

    expect(eventEmitter.onAny).toHaveBeenCalledWith(expect.any(Function));
  });

  it('records a relevant event carrying both tenantId and contractId', async () => {
    await listener.handleEvent('contract.statusChanged', {
      tenantId: 't1',
      contractId: 'c1',
      newStatus: 'approved',
    });

    expect(service.recordEvent).toHaveBeenCalledWith('t1', 'c1', 'contract.statusChanged', {
      tenantId: 't1',
      contractId: 'c1',
      newStatus: 'approved',
    });
  });

  it('ignores events outside the named modules (e.g. platform events)', async () => {
    await listener.handleEvent('billing.subscription.updated', {
      tenantId: 't1',
      plan: 'pro',
      status: 'active',
    });

    expect(service.recordEvent).not.toHaveBeenCalled();
  });

  it('ignores a relevant event missing a contractId', async () => {
    await listener.handleEvent('negotiation.roleAssigned', {
      tenantId: 't1',
      userId: 'u1',
      role: 'reviewer',
    });

    expect(service.recordEvent).not.toHaveBeenCalled();
  });

  it('ignores a non-object payload', async () => {
    await listener.handleEvent('contract.created', 'not-an-object');

    expect(service.recordEvent).not.toHaveBeenCalled();
  });
});
