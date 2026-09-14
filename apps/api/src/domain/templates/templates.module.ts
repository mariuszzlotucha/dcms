import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplateClause } from './entities/template-clause.entity';
import { Template } from './entities/template.entity';
import { TemplatesController } from './templates.controller';
import { TemplatesListener } from './templates.listener';
import { TemplatesService } from './templates.service';

@Module({
  imports: [TypeOrmModule.forFeature([Template, TemplateClause])],
  controllers: [TemplatesController],
  providers: [TemplatesService, TemplatesListener],
  exports: [TemplatesService],
})
export class TemplatesModule {}
