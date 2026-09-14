import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractVersion } from './entities/contract-version.entity';
import { Contract } from './entities/contract.entity';
import { ContractsController } from './contracts.controller';
import { ContractsListener } from './contracts.listener';
import { ContractsService } from './contracts.service';

@Module({
  imports: [TypeOrmModule.forFeature([Contract, ContractVersion])],
  controllers: [ContractsController],
  providers: [ContractsService, ContractsListener],
  exports: [ContractsService],
})
export class ContractsModule {}
