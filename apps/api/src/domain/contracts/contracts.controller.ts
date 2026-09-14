import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { JwtAuthGuard } from '@platform/auth/guards/jwt-auth.guard';
import { Roles } from '@platform/rbac/decorators/roles.decorator';
import { RolesGuard } from '@platform/rbac/guards/roles.guard';
import { ZodValidationPipe } from '@platform/security/pipes/zod-validation.pipe';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';
import {
  ChangeContractStatusDto,
  changeContractStatusSchema,
  ContractStatus,
  CreateContractDto,
  createContractSchema,
  UpdateContractDto,
  updateContractSchema,
} from '@contracts/contract.schema';
import { ContractsService } from './contracts.service';
import { ContractVersion } from './entities/contract-version.entity';
import { Contract } from './entities/contract.entity';

// Minimal shape of what multer actually attaches to the request — avoids a
// dependency on @types/multer (not installed) just for the Express.Multer
// namespace augmentation.
interface UploadedMulterFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

@Controller('contracts')
@UseGuards(JwtAuthGuard)
export class ContractsController {
  constructor(
    private readonly contractsService: ContractsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createContractSchema))
  async createContract(@Body() dto: CreateContractDto, @Req() request: Request): Promise<Contract> {
    const tenantId = await this.tenantContext.getTenantId();
    const userId = (request.user as { userId: string }).userId;
    return this.contractsService.createContract(tenantId, userId, dto);
  }

  @Get()
  async listContracts(@Query('status') status?: ContractStatus): Promise<Contract[]> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.contractsService.listContracts(tenantId, status);
  }

  @Get(':id')
  async getContract(@Param('id') id: string): Promise<Contract> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.contractsService.getContract(tenantId, id);
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(updateContractSchema))
  async updateContract(
    @Param('id') id: string,
    @Body() dto: UpdateContractDto,
    @Req() request: Request,
  ): Promise<Contract> {
    const tenantId = await this.tenantContext.getTenantId();
    const userId = (request.user as { userId: string }).userId;
    return this.contractsService.updateContract(tenantId, id, userId, dto);
  }

  @Post(':id/status')
  @Roles('owner', 'admin')
  @UseGuards(RolesGuard)
  @UsePipes(new ZodValidationPipe(changeContractStatusSchema))
  async changeStatus(@Param('id') id: string, @Body() dto: ChangeContractStatusDto): Promise<Contract> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.contractsService.changeStatus(tenantId, id, dto.status);
  }

  @Post(':id/archive')
  @Roles('owner', 'admin')
  @UseGuards(RolesGuard)
  async archiveContract(@Param('id') id: string): Promise<Contract> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.contractsService.archiveContract(tenantId, id);
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  @UseGuards(RolesGuard)
  async deleteContract(@Param('id') id: string): Promise<void> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.contractsService.deleteContract(tenantId, id);
  }

  @Post(':id/submit-for-approval')
  async submitForApproval(@Param('id') id: string, @Req() request: Request): Promise<void> {
    const tenantId = await this.tenantContext.getTenantId();
    const userId = (request.user as { userId: string }).userId;
    return this.contractsService.submitForApproval(tenantId, id, userId);
  }

  @Post(':id/versions')
  @UseInterceptors(FileInterceptor('file'))
  async uploadVersion(
    @Param('id') id: string,
    @UploadedFile() file: UploadedMulterFile,
    @Req() request: Request,
  ): Promise<ContractVersion> {
    const tenantId = await this.tenantContext.getTenantId();
    const userId = (request.user as { userId: string }).userId;
    return this.contractsService.uploadVersion(tenantId, id, userId, file.buffer, file.originalname, file.mimetype);
  }

  @Get(':id/versions')
  async listVersions(@Param('id') id: string): Promise<ContractVersion[]> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.contractsService.listVersions(tenantId, id);
  }
}
