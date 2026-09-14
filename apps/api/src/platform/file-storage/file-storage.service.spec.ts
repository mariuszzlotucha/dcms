import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SecretsService } from '@platform/secrets/secrets.service';
import { PLATFORM_EVENTS } from '../events';
import { FileStorageService } from './file-storage.service';
import { FileStorageModuleConfig } from './file-storage.config';
import { FileRecord } from './entities/file.entity';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  };
});

jest.mock('@aws-sdk/s3-request-presigner');

const mockedGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;

describe('FileStorageService', () => {
  let files: {
    save: jest.Mock;
    create: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    remove: jest.Mock;
  };
  let secretsService: { getProviderSecret: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let service: FileStorageService;

  const config: FileStorageModuleConfig = {
    bucket: 'dcms-files',
    region: 'eu-central-1',
    maxSizeBytes: 1024,
  };

  beforeEach(() => {
    mockSend.mockReset();
    files = {
      save: jest.fn(async (data) => ({ id: 'f1', ...data }) as FileRecord),
      create: jest.fn((data) => data),
      findOne: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
    };
    secretsService = { getProviderSecret: jest.fn().mockReturnValue('secret-value') };
    eventEmitter = { emit: jest.fn() };

    service = new FileStorageService(
      files as never,
      config,
      secretsService as unknown as SecretsService,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  describe('uploadFile', () => {
    it('rejects a file over the configured size limit without touching S3', async () => {
      const oversized = Buffer.alloc(2048);

      await expect(
        service.uploadFile('t1', 'u1', oversized, 'contract.pdf', 'application/pdf'),
      ).rejects.toThrow(BadRequestException);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('sanitizes an unsafe filename before using it in the storage key', async () => {
      const buffer = Buffer.from('data');

      await service.uploadFile('t1', 'u1', buffer, '../../etc/passwd', 'text/plain');

      const key = mockSend.mock.calls[0][0].input.Key as string;
      expect(key.startsWith('t1/')).toBe(true);
      expect(key.endsWith('-.._.._etc_passwd')).toBe(true);
      // Only the tenant-id separator slash should survive — no path
      // traversal slashes from the original filename make it into the key.
      expect(key.match(/\//g)).toHaveLength(1);
    });

    it('scopes the storage key under the tenant and preserves the original filename in the record', async () => {
      const buffer = Buffer.from('data');

      const record = await service.uploadFile(
        't1',
        'u1',
        buffer,
        'contract.pdf',
        'application/pdf',
      );

      expect(files.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          originalFilename: 'contract.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 4,
          uploadedBy: 'u1',
        }),
      );
      const putCommand = mockSend.mock.calls[0][0];
      expect(putCommand.input.Key.startsWith('t1/')).toBe(true);
      expect(record.originalFilename).toBe('contract.pdf');
    });

    it('emits FILE_UPLOADED with the saved record details', async () => {
      await service.uploadFile('t1', 'u1', Buffer.from('data'), 'contract.pdf', 'application/pdf');

      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.FILE_UPLOADED, {
        tenantId: 't1',
        fileId: 'f1',
        sizeBytes: 4,
        mimeType: 'application/pdf',
      });
    });
  });

  describe('getDownloadUrl', () => {
    it('throws NotFoundException when the file does not belong to the tenant', async () => {
      files.findOne.mockResolvedValue({ id: 'f1', tenantId: 'other-tenant' } as FileRecord);

      await expect(service.getDownloadUrl('t1', 'f1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the file does not exist', async () => {
      files.findOne.mockResolvedValue(null);

      await expect(service.getDownloadUrl('t1', 'f1')).rejects.toThrow(NotFoundException);
    });

    it('returns a signed URL for a file owned by the tenant', async () => {
      files.findOne.mockResolvedValue({
        id: 'f1',
        tenantId: 't1',
        storageKey: 't1/abc-contract.pdf',
      } as FileRecord);
      mockedGetSignedUrl.mockResolvedValue('https://signed-url.example');

      await expect(service.getDownloadUrl('t1', 'f1')).resolves.toBe('https://signed-url.example');
    });
  });

  describe('deleteFile', () => {
    it('throws NotFoundException for a file owned by a different tenant (no S3 call)', async () => {
      files.findOne.mockResolvedValue({ id: 'f1', tenantId: 'other-tenant' } as FileRecord);

      await expect(service.deleteFile('t1', 'f1')).rejects.toThrow(NotFoundException);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('deletes from S3, removes the record, and emits FILE_DELETED', async () => {
      const record = { id: 'f1', tenantId: 't1', storageKey: 't1/abc-contract.pdf' } as FileRecord;
      files.findOne.mockResolvedValue(record);

      await service.deleteFile('t1', 'f1');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ input: expect.objectContaining({ Key: 't1/abc-contract.pdf' }) }),
      );
      expect(files.remove).toHaveBeenCalledWith(record);
      expect(eventEmitter.emit).toHaveBeenCalledWith(PLATFORM_EVENTS.FILE_DELETED, {
        tenantId: 't1',
        fileId: 'f1',
      });
    });
  });

  describe('listFiles / listAllFiles / listFilesByUploader', () => {
    it('listFiles scopes the query to the given tenant', async () => {
      await service.listFiles('t1');

      expect(files.find).toHaveBeenCalledWith({ where: { tenantId: 't1' } });
    });

    it('listAllFiles queries with no filter at all', async () => {
      await service.listAllFiles();

      expect(files.find).toHaveBeenCalledWith();
    });

    it('listFilesByUploader scopes the query to the given uploader', async () => {
      await service.listFilesByUploader('u1');

      expect(files.find).toHaveBeenCalledWith({ where: { uploadedBy: 'u1' } });
    });
  });
});
