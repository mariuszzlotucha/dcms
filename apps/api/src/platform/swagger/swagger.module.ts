import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule as NestSwaggerModule } from '@nestjs/swagger';
import { SwaggerModuleConfig } from './swagger.config';

export function setupSwagger(app: INestApplication, config: SwaggerModuleConfig): void {
  if (!config.enabled) {
    return;
  }

  const documentConfig = new DocumentBuilder()
    .setTitle(config.title)
    .setDescription(config.description)
    .setVersion(config.version)
    .addBearerAuth()
    .build();

  const document = NestSwaggerModule.createDocument(app, documentConfig);
  NestSwaggerModule.setup(config.path, app, document);
}
