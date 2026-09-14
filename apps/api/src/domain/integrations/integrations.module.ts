import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationConnection } from './entities/integration-connection.entity';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsListener } from './integrations.listener';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [TypeOrmModule.forFeature([IntegrationConnection])],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, IntegrationsListener],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
