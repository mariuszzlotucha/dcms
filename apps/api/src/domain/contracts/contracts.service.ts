import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileStorageService } from '@platform/file-storage/file-storage.service';
import { UsageMeteringService } from '@platform/usage-metering/usage-metering.service';
import { EVENTS, EventPayloadMap } from '@';
import type { ContractStatus, CreateContractDto, UpdateContractDto } from '@contracts/contract.schema';
import { ContractVersion } from './entities/contract-version.entity';
import { Contract } from './entities/contract.entity';

// The metric key usage-metering is pre-configured with in app.module.ts
// (limitsByPlan['contracts.create']) — shared by both contract creation and
// new versions, since no separate "versions" limit is configured.
const USAGE_METRIC = 'contracts.create';

// Mirrors the lifecycle in dcms-domain-architecture.md 1.1. `approved` is
// only reachable once the (not-yet-built) negotiation-approval module grants
// approval — for now it's reachable directly via changeStatus() like any
// other transition; a listener wiring it to `approval.granted` belongs to
// whichever module builds that event, per the "don't build a listener for an
// event that doesn't exist yet" sequencing principle.
const ALLOWED_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  draft: ['in_review', 'archived'],
  in_review: ['negotiation', 'draft', 'archived'],
  negotiation: ['approved', 'in_review', 'archived'],
  approved: ['signed', 'negotiation', 'archived'],
  signed: ['active', 'archived'],
  active: ['expired', 'terminated'],
  expired: [],
  terminated: [],
  archived: [],
};

// A contract can't gain new versions or be deleted once it's left editable
// territory — signing/activity/expiry/termination/archival all freeze it.
const EDITABLE_STATUSES: ContractStatus[] = ['draft', 'in_review', 'negotiation', 'approved'];

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract)
    private readonly contracts: Repository<Contract>,
    @InjectRepository(ContractVersion)
    private readonly versions: Repository<ContractVersion>,
    private readonly fileStorageService: FileStorageService,
    private readonly usageMeteringService: UsageMeteringService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createContract(tenantId: string, createdBy: string, dto: CreateContractDto): Promise<Contract> {
    await this.checkUsageLimit(tenantId);

    const contract = await this.contracts.save(
      this.contracts.create({
        tenantId,
        createdBy,
        name: dto.name,
        description: dto.description ?? null,
        templateId: dto.templateId ?? null,
        status: 'draft',
      }),
    );

    this.eventEmitter.emit(
      EVENTS.CONTRACT_CREATED,
      {
        contractId: contract.id,
        tenantId,
        templateId: contract.templateId,
        createdBy,
      } satisfies EventPayloadMap[typeof EVENTS.CONTRACT_CREATED],
    );

    return contract;
  }

  async updateContract(
    tenantId: string,
    contractId: string,
    updatedBy: string,
    dto: UpdateContractDto,
  ): Promise<Contract> {
    const contract = await this.getContract(tenantId, contractId);
    this.assertEditable(contract);

    Object.assign(contract, dto);
    const saved = await this.contracts.save(contract);

    this.eventEmitter.emit(
      EVENTS.CONTRACT_UPDATED,
      { contractId: saved.id, tenantId, updatedBy } satisfies EventPayloadMap[typeof EVENTS.CONTRACT_UPDATED],
    );

    return saved;
  }

  async changeStatus(tenantId: string, contractId: string, newStatus: ContractStatus): Promise<Contract> {
    const { contract, previousStatus } = await this.transitionStatus(tenantId, contractId, newStatus);

    this.eventEmitter.emit(
      EVENTS.CONTRACT_STATUS_CHANGED,
      {
        contractId: contract.id,
        tenantId,
        previousStatus,
        newStatus,
      } satisfies EventPayloadMap[typeof EVENTS.CONTRACT_STATUS_CHANGED],
    );

    return contract;
  }

  async archiveContract(tenantId: string, contractId: string): Promise<Contract> {
    const { contract } = await this.transitionStatus(tenantId, contractId, 'archived');

    this.eventEmitter.emit(
      EVENTS.CONTRACT_ARCHIVED,
      { contractId: contract.id, tenantId } satisfies EventPayloadMap[typeof EVENTS.CONTRACT_ARCHIVED],
    );

    return contract;
  }

  // Only draft contracts are deletable — anything past draft has already
  // been shared/reviewed, so it's archived instead (an audit-preserving
  // action), never hard-deleted.
  async deleteContract(tenantId: string, contractId: string): Promise<void> {
    const contract = await this.getContract(tenantId, contractId);

    if (contract.status !== 'draft') {
      throw new BadRequestException('Only draft contracts can be deleted; archive it instead');
    }

    await this.versions.delete({ tenantId, contractId });
    await this.contracts.remove(contract);

    this.eventEmitter.emit(
      EVENTS.CONTRACT_DELETED,
      { contractId, tenantId } satisfies EventPayloadMap[typeof EVENTS.CONTRACT_DELETED],
    );
  }

  async submitForApproval(tenantId: string, contractId: string, submittedBy: string): Promise<void> {
    const contract = await this.getContract(tenantId, contractId);

    if (contract.status !== 'negotiation') {
      throw new BadRequestException('Only a contract in negotiation can be submitted for approval');
    }

    this.eventEmitter.emit(
      EVENTS.CONTRACT_SUBMITTED_FOR_APPROVAL,
      { contractId, tenantId, submittedBy } satisfies EventPayloadMap[typeof EVENTS.CONTRACT_SUBMITTED_FOR_APPROVAL],
    );
  }

  async getContract(tenantId: string, contractId: string): Promise<Contract> {
    const contract = await this.contracts.findOne({ where: { id: contractId, tenantId } });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    return contract;
  }

  async listContracts(tenantId: string, status?: ContractStatus): Promise<Contract[]> {
    return this.contracts.find({ where: { tenantId, ...(status ? { status } : {}) } });
  }

  async uploadVersion(
    tenantId: string,
    contractId: string,
    uploadedBy: string,
    buffer: Buffer,
    originalFilename: string,
    mimeType: string,
  ): Promise<ContractVersion> {
    const contract = await this.getContract(tenantId, contractId);
    this.assertEditable(contract);
    await this.checkUsageLimit(tenantId);

    const file = await this.fileStorageService.uploadFile(tenantId, uploadedBy, buffer, originalFilename, mimeType);
    const versionNumber = (await this.versions.count({ where: { tenantId, contractId } })) + 1;

    const version = await this.versions.save(
      this.versions.create({ tenantId, contractId, versionNumber, fileId: file.id, createdBy: uploadedBy }),
    );

    this.eventEmitter.emit(
      EVENTS.CONTRACT_VERSION_CREATED,
      {
        contractId,
        tenantId,
        versionId: version.id,
        createdBy: uploadedBy,
      } satisfies EventPayloadMap[typeof EVENTS.CONTRACT_VERSION_CREATED],
    );

    return version;
  }

  async listVersions(tenantId: string, contractId: string): Promise<ContractVersion[]> {
    await this.getContract(tenantId, contractId);
    return this.versions.find({ where: { tenantId, contractId }, order: { versionNumber: 'DESC' } });
  }

  private assertEditable(contract: Contract): void {
    if (!EDITABLE_STATUSES.includes(contract.status)) {
      throw new BadRequestException(`Contract in status "${contract.status}" can no longer be edited`);
    }
  }

  private async checkUsageLimit(tenantId: string): Promise<void> {
    const usage = await this.usageMeteringService.checkAndIncrement(tenantId, USAGE_METRIC);

    if (!usage.allowed) {
      throw new ForbiddenException('Plan limit for contracts reached');
    }
  }

  private async transitionStatus(
    tenantId: string,
    contractId: string,
    newStatus: ContractStatus,
  ): Promise<{ contract: Contract; previousStatus: ContractStatus }> {
    const contract = await this.getContract(tenantId, contractId);
    const previousStatus = contract.status;

    if (previousStatus === newStatus) {
      throw new BadRequestException(`Contract is already "${newStatus}"`);
    }

    if (!ALLOWED_TRANSITIONS[previousStatus].includes(newStatus)) {
      throw new BadRequestException(`Cannot move contract from "${previousStatus}" to "${newStatus}"`);
    }

    contract.status = newStatus;
    const saved = await this.contracts.save(contract);

    return { contract: saved, previousStatus };
  }
}
