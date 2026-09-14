import { BadRequestException } from '@nestjs/common';
import { ContractsListener } from './contracts.listener';
import { ContractsService } from './contracts.service';

describe('ContractsListener', () => {
  let contractsService: { changeStatus: jest.Mock };
  let listener: ContractsListener;

  beforeEach(() => {
    contractsService = { changeStatus: jest.fn() };
    listener = new ContractsListener(contractsService as unknown as ContractsService);
  });

  it('moves the contract to approved on approval.granted', async () => {
    contractsService.changeStatus.mockResolvedValue({ id: 'c1', status: 'approved' });

    await listener.handleApprovalGranted({ contractId: 'c1', tenantId: 't1', approverId: 'approver-1' });

    expect(contractsService.changeStatus).toHaveBeenCalledWith('t1', 'c1', 'approved');
  });

  it('swallows an invalid-transition error (e.g. a second approver granting after the first already moved it)', async () => {
    contractsService.changeStatus.mockRejectedValue(new BadRequestException('Contract is already "approved"'));

    await expect(
      listener.handleApprovalGranted({ contractId: 'c1', tenantId: 't1', approverId: 'approver-2' }),
    ).resolves.toBeUndefined();
  });

  it('re-throws unexpected errors instead of swallowing them', async () => {
    contractsService.changeStatus.mockRejectedValue(new Error('db connection lost'));

    await expect(
      listener.handleApprovalGranted({ contractId: 'c1', tenantId: 't1', approverId: 'approver-1' }),
    ).rejects.toThrow('db connection lost');
  });
});
