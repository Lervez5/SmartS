import { config } from '../../config';
import { logger } from '../../shared/logger';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

type SupportedProviders = 'local' | 's3';

export interface StoredFile {
  filename: string;
  url: string;
  path: string;
  size: number;
}

export class StorageProvider {
  private provider: SupportedProviders;

  constructor() {
    this.provider = config.storage.provider;
  }

  async upload(
    buffer: Buffer,
    filename: string,
    directory: string = 'uploads'
  ): Promise<StoredFile> {
    if (this.provider === 's3') {
      return this.uploadS3(buffer, filename, directory);
    }
    return this.uploadLocal(buffer, filename, directory);
  }

  private async uploadLocal(
    buffer: Buffer,
    filename: string,
    directory: string
  ): Promise<StoredFile> {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    const storedName = `${base}-${uuidv4()}${ext}`;
    const dir = path.resolve(config.storage.localRoot, directory);

    await fs.mkdir(dir, { recursive: true });

    const fullPath = path.join(dir, storedName);
    await fs.writeFile(fullPath, buffer);

    const stats = await fs.stat(fullPath);
    const relativePath = path.relative(config.storage.localRoot, fullPath);

    return {
      filename: storedName,
      url: `/uploads/${relativePath}`,
      path: relativePath,
      size: stats.size,
    };
  }

  private async uploadS3(buffer: Buffer, filename: string, directory: string): Promise<StoredFile> {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

    const s3 = new S3Client({
      region: config.storage.s3Region,
      credentials: {
        accessKeyId: config.storage.s3AccessKeyId || '',
        secretAccessKey: config.storage.s3SecretAccessKey || '',
      },
    });

    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    const storedName = `${base}-${uuidv4()}${ext}`;
    const key = `${directory}/${storedName}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: config.storage.s3Bucket,
        Key: key,
        Body: buffer,
      })
    );

    const url = `https://${config.storage.s3Bucket}.s3.${config.storage.s3Region}.amazonaws.com/${key}`;

    return {
      filename: storedName,
      url,
      path: key,
      size: buffer.length,
    };
  }

  async delete(filepath: string): Promise<void> {
    if (this.provider === 's3') {
      const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const s3 = new S3Client({
        region: config.storage.s3Region,
        credentials: {
          accessKeyId: config.storage.s3AccessKeyId || '',
          secretAccessKey: config.storage.s3SecretAccessKey || '',
        },
      });
      await s3.send(
        new DeleteObjectCommand({
          Bucket: config.storage.s3Bucket,
          Key: filepath,
        })
      );
    } else {
      const fullPath = path.resolve(config.storage.localRoot, filepath);
      await fs.unlink(fullPath).catch(() => {});
    }

    logger.info('File deleted', { event: 'file_deleted', url: filepath });
  }
}

export const storage = new StorageProvider();
