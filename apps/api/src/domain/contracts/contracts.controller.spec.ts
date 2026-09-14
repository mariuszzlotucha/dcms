import { Request } from 'express';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';

describe('ContractsController', () => {
  let contractsService: {
    createContract: jest.Mock;
    listContracts: jest.Mock;
    getContract: jest.Mock;
    updateContract: jest.Mock;
    changeStatus: jest.Mock;
    archiveContract: jest.Mock;
    deleteContract: jest.Mock;
    submitForApproval: jest.Mock;
    uploadVersion: jest.Mock;
    listVersions: jest.Mock;
  };
  let tenantContext: { getTenantId: jest.Mock };
  let controller: ContractsController;

  const requestAs = (userId: string): Request => ({ user: { userId } }) as unknown as Request;

  beforeEach(() => {
    contractsService = {
      createContract: jest.fn(),
      listContracts: jest.fn(),
      getContract: jest.fn(),
      updateContract: jest.fn(),
      changeStatus: jest.fn(),
      archiveContract: jest.fn(),
      deleteContract: jest.fn(),
      submitForApproval: jest.fn(),
      uploadVersion: jest.fn(),
      listVersions: jest.fn(),
    };
    tenantContext = { getTenantId: jest.fn().mockResolvedValue('t1') };
    controller = new ContractsController(
      contractsService as unknown as ContractsService,
      tenantContext as unknown as TenantContextService,
    );
  });

  it('creates a contract scoped to the resolved tenant and authenticated user', async () => {
    contractsService.createContract.mockResolvedValue({ id: 'c1' });

    const dto = { name: 'MSA' };
    await controller.createContract(dto, requestAs('u1'));

    expect(contractsService.createContract).toHaveBeenCalledWith('t1', 'u1', dto);
  });

  it('lists contracts scoped to the resolved tenant', async () => {
    contractsService.listContracts.mockResolvedValue([]);

    await controller.listContracts('draft');

    expect(contractsService.listContracts).toHaveBeenCalledWith('t1', 'draft');
  });

  it('changes status scoped to the resolved tenant', async () => {
    contractsService.changeStatus.mockResolvedValue({ id: 'c1', status: 'in_review' });

    await controller.changeStatus('c1', { status: 'in_review' });

    expect(contractsService.changeStatus).toHaveBeenCalledWith('t1', 'c1', 'in_review');
  });

  it('uploads a version using the authenticated user and resolved tenant', async () => {
    contractsService.uploadVersion.mockResolvedValue({ id: 'v1' });
    const file = { buffer: Buffer.from('x'), originalname: 'a.pdf', mimetype: 'application/pdf' };

    await controller.uploadVersion('c1', file, requestAs('u1'));

    expect(contractsService.uploadVersion).toHaveBeenCalledWith(
      't1',
      'c1',
      'u1',
      file.buffer,
      'a.pdf',
      'application/pdf',
    );
  });

  it('submits for approval using the authenticated user and resolved tenant', async () => {
    await controller.submitForApproval('c1', requestAs('u1'));

    expect(contractsService.submitForApproval).toHaveBeenCalledWith('t1', 'c1', 'u1');
  });

  it('gets a single contract scoped to the resolved tenant', async () => {
    contractsService.getContract.mockResolvedValue({ id: 'c1' });

    await controller.getContract('c1');

    expect(contractsService.getContract).toHaveBeenCalledWith('t1', 'c1');
  });

  it('updates a contract scoped to the resolved tenant and authenticated user', async () => {
    contractsService.updateContract.mockResolvedValue({ id: 'c1' });

    await controller.updateContract('c1', { name: 'New name' }, requestAs('u1'));

    expect(contractsService.updateContract).toHaveBeenCalledWith('t1', 'c1', 'u1', {
      name: 'New name',
    });
  });

  it('archives a contract scoped to the resolved tenant', async () => {
    contractsService.archiveContract.mockResolvedValue({ id: 'c1', status: 'archived' });

    await controller.archiveContract('c1');

    expect(contractsService.archiveContract).toHaveBeenCalledWith('t1', 'c1');
  });

  it('deletes a contract scoped to the resolved tenant', async () => {
    await controller.deleteContract('c1');

    expect(contractsService.deleteContract).toHaveBeenCalledWith('t1', 'c1');
  });

  it('lists versions scoped to the resolved tenant', async () => {
    contractsService.listVersions.mockResolvedValue([]);

    await controller.listVersions('c1');

    expect(contractsService.listVersions).toHaveBeenCalledWith('t1', 'c1');
  });
});
