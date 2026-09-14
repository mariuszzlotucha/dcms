import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule as NestSwaggerModule } from '@nestjs/swagger';
import { setupSwagger } from './swagger.module';
import { SwaggerModuleConfig } from './swagger.config';

jest.mock('@nestjs/swagger', () => ({
  DocumentBuilder: jest.fn().mockImplementation(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setVersion: jest.fn().mockReturnThis(),
    addBearerAuth: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue({ built: true }),
  })),
  SwaggerModule: {
    createDocument: jest.fn().mockReturnValue({ document: true }),
    setup: jest.fn(),
  },
}));

describe('setupSwagger', () => {
  const app = {} as INestApplication;
  const config: SwaggerModuleConfig = {
    path: 'docs',
    title: 'DCMS API',
    description: 'Digital Contract Management System',
    version: '1.0',
    enabled: true,
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when disabled — no document is built or mounted', () => {
    setupSwagger(app, { ...config, enabled: false });

    expect(DocumentBuilder).not.toHaveBeenCalled();
    expect(NestSwaggerModule.createDocument).not.toHaveBeenCalled();
    expect(NestSwaggerModule.setup).not.toHaveBeenCalled();
  });

  it('builds and mounts the document at the configured path when enabled', () => {
    setupSwagger(app, config);

    expect(NestSwaggerModule.createDocument).toHaveBeenCalledWith(app, { built: true });
    expect(NestSwaggerModule.setup).toHaveBeenCalledWith('docs', app, { document: true });
  });

  it('sets title, description, and version from config on the document builder', () => {
    setupSwagger(app, config);

    const builderInstance = (DocumentBuilder as jest.Mock).mock.results[0].value;
    expect(builderInstance.setTitle).toHaveBeenCalledWith('DCMS API');
    expect(builderInstance.setDescription).toHaveBeenCalledWith(
      'Digital Contract Management System',
    );
    expect(builderInstance.setVersion).toHaveBeenCalledWith('1.0');
    expect(builderInstance.addBearerAuth).toHaveBeenCalled();
  });
});
