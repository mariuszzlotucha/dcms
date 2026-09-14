import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { Contract } from './entities/contract.entity';
import { ContractVersion } from './entities/contract-version.entity';

describe('ContractsService', () => {
  let contracts: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  let versions: {
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    count: jest.Mock;
    delete: jest.Mock;
  };
  let fileStorageService: { uploadFile: jest.Mock };
  let usageMeteringService: { checkAndIncrement: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let service: ContractsService;

  beforeEach(() => {
    contracts = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => data as Contract),
      save: jest.fn(async (data) => ({ id: 'c1', ...data }) as Contract),
      remove: jest.fn(),
    };
    versions = {
      find: jest.fn(),
      create: jest.fn((data) => data as ContractVersion),
      save: jest.fn(async (data) => ({ id: 'v1', ...data }) as ContractVersion),
      count: jest.fn().mockResolvedValue(0),
      delete: jest.fn(),
    };
    fileStorageService = { uploadFile: jest.fn().mockResolvedValue({ id: 'file-1' }) };
    usageMeteringService = { checkAndIncrement: jest.fn().mockResolvedValue({ allowed: true, current: 1, limit: 10 }) };
    eventEmitter = { emit: jest.fn() };

    service = new ContractsService(
      contracts as never,
      versions as never,
      fileStorageService as never,
      usageMeteringService as never,
      eventEmitter as never,
    );
  });

  describe('createContract', () => {
    it('creates a draft contract after checking the usage limit and emits contract.created', async () => {
      const result = await service.createContract('t1', 'u1', { name: 'MSA', templateId: undefined });

      expect(usageMeteringService.checkAndIncrement).toHaveBeenCalledWith('t1', 'contracts.create');
      expect(contracts.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 't1', createdBy: 'u1', status: 'draft' }),
      );
      expect(result.id).toBe('c1');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'contract.created',
        expect.objectContaining({ contractId: 'c1', tenantId: 't1', createdBy: 'u1' }),
      );
    });

    it('rejects creation once the plan limit is exceeded', async () => {
      usageMeteringService.checkAndIncrement.mockResolvedValue({ allowed: false, current: 10, limit: 10 });

      await expect(service.createContract('t1', 'u1', { name: 'MSA' })).rejects.toBeInstanceOf(ForbiddenException);
      expect(contracts.save).not.toHaveBeenCalled();
    });
  });

  describe('getContract', () => {
    it('throws NotFound when the contract does not belong to the tenant', async () => {
      contracts.findOne.mockResolvedValue(null);

      await expect(service.getContract('t1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
      expect(contracts.findOne).toHaveBeenCalledWith({ where: { id: 'missing', tenantId: 't1' } });
    });
  });

  describe('updateContract', () => {
    it('rejects edits once the contract has left editable territory', async () => {
      contracts.findOne.mockResolvedValue({ id: 'c1', tenantId: 't1', status: 'signed' });

      await expect(service.updateContract('t1', 'c1', 'u1', { name: 'New name' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('changeStatus', () => {
    it('applies an allowed transition and emits contract.statusChanged with both statuses', async () => {
      contracts.findOne.mockResolvedValue({ id: 'c1', tenantId: 't1', status: 'draft' });

      const result = await service.changeStatus('t1', 'c1', 'in_review');

      expect(result.status).toBe('in_review');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'contract.statusChanged',
        expect.objectContaining({ contractId: 'c1', tenantId: 't1', previousStatus: 'draft', newStatus: 'in_review' }),
      );
    });

    it('rejects a transition that skips the documented lifecycle', async () => {
      contracts.findOne.mockResolvedValue({ id: 'c1', tenantId: 't1', status: 'draft' });

      await expect(service.changeStatus('t1', 'c1', 'signed')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects transitioning out of a terminal status', async () => {
      contracts.findOne.mockResolvedValue({ id: 'c1', tenantId: 't1', status: 'terminated' });

      await expect(service.changeStatus('t1', 'c1', 'active')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('archiveContract', () => {
    it('archives an editable contract and emits contract.archived (not statusChanged)', async () => {
      contracts.findOne.mockResolvedValue({ id: 'c1', tenantId: 't1', status: 'draft' });

      const result = await service.archiveContract('t1', 'c1');

      expect(result.status).toBe('archived');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'contract.archived',
        expect.objectContaining({ contractId: 'c1', tenantId: 't1' }),
      );
      expect(eventEmitter.emit).not.toHaveBeenCalledWith('contract.statusChanged', expect.anything());
    });
  });

  describe('deleteContract', () => {
    it('deletes a draft contract along with its versions and emits contract.deleted', async () => {
      contracts.findOne.mockResolvedValue({ id: 'c1', tenantId: 't1', status: 'draft' });

      await service.deleteContract('t1', 'c1');

      expect(versions.delete).toHaveBeenCalledWith({ tenantId: 't1', contractId: 'c1' });
      expect(contracts.remove).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'contract.deleted',
        expect.objectContaining({ contractId: 'c1', tenantId: 't1' }),
      );
    });

    it('refuses to delete a contract past draft', async () => {
      contracts.findOne.mockResolvedValue({ id: 'c1', tenantId: 't1', status: 'in_review' });

      await expect(service.deleteContract('t1', 'c1')).rejects.toBeInstanceOf(BadRequestException);
      expect(contracts.remove).not.toHaveBeenCalled();
    });
  });

  describe('submitForApproval', () => {
    it('emits contract.submittedForApproval once negotiation is underway', async () => {
      contracts.findOne.mockResolvedValue({ id: 'c1', tenantId: 't1', status: 'negotiation' });

      await service.submitForApproval('t1', 'c1', 'u1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'contract.submittedForApproval',
        expect.objectContaining({ contractId: 'c1', tenantId: 't1', submittedBy: 'u1' }),
      );
    });

    it('rejects submission outside of negotiation', async () => {
      contracts.findOne.mockResolvedValue({ id: 'c1', tenantId: 't1', status: 'draft' });

      await expect(service.submitForApproval('t1', 'c1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('uploadVersion', () => {
    it('uploads a file, checks the usage limit, and emits contract.versionCreated', async () => {
      contracts.findOne.mockResolvedValue({ id: 'c1', tenantId: 't1', status: 'draft' });

      const result = await service.uploadVersion('t1', 'c1', 'u1', Buffer.from('x'), 'a.pdf', 'application/pdf');

      expect(usageMeteringService.checkAndIncrement).toHaveBeenCalledWith('t1', 'contracts.create');
      expect(fileStorageService.uploadFile).toHaveBeenCalledWith('t1', 'u1', Buffer.from('x'), 'a.pdf', 'application/pdf');
      expect(versions.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 't1', contractId: 'c1', versionNumber: 1, fileId: 'file-1' }),
      );
      expect(result.id).toBe('v1');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'contract.versionCreated',
        expect.objectContaining({ contractId: 'c1', tenantId: 't1', versionId: 'v1', createdBy: 'u1' }),
      );
    });

    it('refuses new versions once the contract has left editable territory', async () => {
      contracts.findOne.mockResolvedValue({ id: 'c1', tenantId: 't1', status: 'active' });

      await expect(
        service.uploadVersion('t1', 'c1', 'u1', Buffer.from('x'), 'a.pdf', 'application/pdf'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(fileStorageService.uploadFile).not.toHaveBeenCalled();
    });
  });
});
