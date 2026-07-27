import { randomUUID } from 'crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecretsService } from '@platform/secrets/secrets.service';
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../events';
import { FileRecord } from './entities/file.entity';
import { FILE_STORAGE_MODULE_CONFIG, FileStorageModuleConfig } from './file-storage.config';

const DOWNLOAD_URL_EXPIRY_SECONDS = 300;

@Injectable()
export class FileStorageService {
  private readonly client: S3Client;

  constructor(
    @InjectRepository(FileRecord)
    private readonly files: Repository<FileRecord>,
    @Inject(FILE_STORAGE_MODULE_CONFIG)
    private readonly config: FileStorageModuleConfig,
    private readonly secretsService: SecretsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: this.secretsService.getProviderSecret('s3AccessKeyId'),
        secretAccessKey: this.secretsService.getProviderSecret('s3SecretAccessKey'),
      },
    });
  }

  async uploadFile(
    tenantId: string,
    uploadedBy: string,
    buffer: Buffer,
    originalFilename: string,
    mimeType: string,
  ): Promise<FileRecord> {
    if (buffer.byteLength > this.config.maxSizeBytes) {
      throw new BadRequestException('File exceeds maximum allowed size');
    }

    const storageKey = `${tenantId}/${randomUUID()}-${originalFilename}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: mimeType,
      }),
    );

    const fileRecord = await this.files.save(
      this.files.create({
        tenantId,
        storageKey,
        originalFilename,
        mimeType,
        sizeBytes: buffer.byteLength,
        uploadedBy,
      }),
    );

    this.eventEmitter.emit(
      PLATFORM_EVENTS.FILE_UPLOADED,
      {
        tenantId,
        fileId: fileRecord.id,
        sizeBytes: fileRecord.sizeBytes,
        mimeType: fileRecord.mimeType,
      } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.FILE_UPLOADED],
    );

    return fileRecord;
  }

  async getDownloadUrl(tenantId: string, fileId: string): Promise<string> {
    const fileRecord = await this.findOwnedFile(tenantId, fileId);

    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.config.bucket, Key: fileRecord.storageKey }),
      { expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS },
    );
  }

  async deleteFile(tenantId: string, fileId: string): Promise<void> {
    const fileRecord = await this.findOwnedFile(tenantId, fileId);

    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: fileRecord.storageKey }));
    await this.files.remove(fileRecord);

    this.eventEmitter.emit(
      PLATFORM_EVENTS.FILE_DELETED,
      { tenantId, fileId } satisfies PlatformEventPayloadMap[typeof PLATFORM_EVENTS.FILE_DELETED],
    );
  }

  private async findOwnedFile(tenantId: string, fileId: string): Promise<FileRecord> {
    const fileRecord = await this.files.findOne({ where: { id: fileId } });

    if (!fileRecord || fileRecord.tenantId !== tenantId) {
      throw new NotFoundException('File not found');
    }

    return fileRecord;
  }
}
