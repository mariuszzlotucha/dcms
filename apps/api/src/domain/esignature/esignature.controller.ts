import { Body, Controller, Get, Param, Post, UseGuards, UsePipes } from '@nestjs/common';
import { JwtAuthGuard } from '@platform/auth/guards/jwt-auth.guard';
import { Roles } from '@platform/rbac/decorators/roles.decorator';
import { RolesGuard } from '@platform/rbac/guards/roles.guard';
import { ZodValidationPipe } from '@platform/security/pipes/zod-validation.pipe';
import { TenantContextService } from '@platform/tenants/context/tenant-context.service';
import { RequestSignatureDto, requestSignatureSchema } from '@contracts/esignature.schema';
import { SignatureEnvelope } from './entities/signature-envelope.entity';
import { EsignatureService } from './esignature.service';

@Controller('contracts/:contractId/esignature')
@UseGuards(JwtAuthGuard)
export class EsignatureController {
  constructor(
    private readonly esignatureService: EsignatureService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Post('envelopes')
  @Roles('owner', 'admin')
  @UseGuards(RolesGuard)
  @UsePipes(new ZodValidationPipe(requestSignatureSchema))
  async requestSignature(
    @Param('contractId') contractId: string,
    @Body() dto: RequestSignatureDto,
  ): Promise<SignatureEnvelope> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.esignatureService.requestSignature(
      tenantId,
      contractId,
      dto.fileId,
      dto.signerEmail,
      dto.signerName,
    );
  }

  @Get('envelopes')
  async listEnvelopes(@Param('contractId') contractId: string): Promise<SignatureEnvelope[]> {
    const tenantId = await this.tenantContext.getTenantId();
    return this.esignatureService.listEnvelopes(tenantId, contractId);
  }
}
