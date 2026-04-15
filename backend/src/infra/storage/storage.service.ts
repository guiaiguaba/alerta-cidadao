import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicEndpoint: string;

  constructor() {
    this.bucket = process.env.STORAGE_BUCKET ?? 'alertacidadao';
    this.publicEndpoint = process.env.STORAGE_PUBLIC_URL ?? '';

    this.s3 = new S3Client({
      endpoint: process.env.STORAGE_ENDPOINT,           // MinIO endpoint
      region: process.env.STORAGE_REGION ?? 'us-east-1',
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY ?? '',
        secretAccessKey: process.env.STORAGE_SECRET_KEY ?? '',
      },
      forcePathStyle: true, // necessário para MinIO
    });
  }

  async upload(
    buffer: Buffer,
    mimetype: string,
    folder: string,
  ): Promise<{ key: string; url: string }> {
    const ext = mimetype.split('/')[1] ?? 'bin';
    const key = `${folder}/${uuidv4()}.${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      }),
    );

    const url = `${this.publicEndpoint}/${this.bucket}/${key}`;
    this.logger.log(`Uploaded: ${key}`);
    return { key, url };
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, command, { expiresIn });
  }
}
