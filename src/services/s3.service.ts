import { config } from '../config/env.config.js';
import { AWS_S3_BUCKET, s3Client } from '../config/s3.config.js';
import { logger } from './logger.service.js';
import { CreateBucketCommand, DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, HeadBucketCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

async function streamToBuffer(stream: Readable | any): Promise<Buffer> {
  if (Buffer.isBuffer(stream)) {
    return stream;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function ensureBucketExists(): Promise<void> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: AWS_S3_BUCKET }));
    logger.db.info(`Bucket S3 '${AWS_S3_BUCKET}' verificado y disponible.`);
  } catch (err: any) {
    const statusCode = err?.$metadata?.httpStatusCode;
    if (statusCode === 404 || err.name === 'NotFound' || err.name === 'NoSuchBucket') {
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: AWS_S3_BUCKET }));
        logger.db.info(`Bucket S3 '${AWS_S3_BUCKET}' creado exitosamente.`);
      } catch (createErr) {
        logger.db.error(`Error al crear bucket S3 '${AWS_S3_BUCKET}'`, createErr);
      }
    } else {
      logger.db.error(`Error al verificar bucket S3 '${AWS_S3_BUCKET}'`, err);
    }
  }
}

export async function putObject(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType?: string,
  metadata?: Record<string, string>
): Promise<{ etag?: string; sizeBytes: number }> {
  const normalizedKey = key.replace(/^\/+/, '');
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const command = new PutObjectCommand({
    Bucket: AWS_S3_BUCKET,
    Key: normalizedKey,
    Body: buffer,
    ContentType: contentType,
    Metadata: metadata,
  });

  const response = await s3Client.send(command);
  return {
    etag: response.ETag,
    sizeBytes: buffer.length,
  };
}

export async function getObject(
  key: string
): Promise<{ buffer: Buffer; contentLength?: number; contentType?: string; etag?: string } | null> {
  const normalizedKey = key.replace(/^\/+/, '');
  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: normalizedKey,
      })
    );

    if (!response.Body) {
      return null;
    }

    const buffer = await streamToBuffer(response.Body);
    return {
      buffer,
      contentLength: response.ContentLength ?? buffer.length,
      contentType: response.ContentType,
      etag: response.ETag,
    };
  } catch (err: any) {
    const statusCode = err?.$metadata?.httpStatusCode;
    if (statusCode === 404 || err.name === 'NoSuchKey' || err.name === 'NotFound') {
      return null;
    }
    logger.db.error(`Error al obtener objeto S3 '${normalizedKey}'`, err);
    return null;
  }
}

export async function headObject(
  key: string
): Promise<{ contentLength?: number; contentType?: string; etag?: string } | null> {
  const normalizedKey = key.replace(/^\/+/, '');
  try {
    const response = await s3Client.send(
      new HeadObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: normalizedKey,
      })
    );

    return {
      contentLength: response.ContentLength,
      contentType: response.ContentType,
      etag: response.ETag,
    };
  } catch (err: any) {
    const statusCode = err?.$metadata?.httpStatusCode;
    if (statusCode === 404 || err.name === 'NotFound' || err.name === 'NoSuchKey') {
      return null;
    }
    logger.db.error(`Error al consultar metadatos de objeto S3 '${normalizedKey}'`, err);
    return null;
  }
}

export async function deleteObject(key: string): Promise<boolean> {
  const normalizedKey = key.replace(/^\/+/, '');
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: normalizedKey,
      })
    );
    return true;
  } catch (err) {
    logger.db.error(`Error al eliminar objeto S3 '${normalizedKey}'`, err);
    return false;
  }
}

export async function deleteObjectsByPrefix(prefix: string): Promise<number> {
  const normalizedPrefix = prefix.replace(/^\/+/, '');
  let totalDeleted = 0;
  let continuationToken: string | undefined;

  try {
    do {
      const listCommand: ListObjectsV2Command = new ListObjectsV2Command({
        Bucket: AWS_S3_BUCKET,
        Prefix: normalizedPrefix,
        ContinuationToken: continuationToken,
      });
      const listResult = await s3Client.send(listCommand);

      if (listResult.Contents && listResult.Contents.length > 0) {
        const objectsToDelete = listResult.Contents.map((item) => ({ Key: item.Key! }));
        await s3Client.send(
          new DeleteObjectsCommand({
            Bucket: AWS_S3_BUCKET,
            Delete: { Objects: objectsToDelete },
          })
        );
        totalDeleted += objectsToDelete.length;
      }

      continuationToken = listResult.NextContinuationToken;
    } while (continuationToken);

    return totalDeleted;
  } catch (err) {
    logger.db.error(`Error al eliminar objetos S3 con prefijo '${normalizedPrefix}'`, err);
    return totalDeleted;
  }
}

export function getPublicUrl(key: string): string {
  const normalizedKey = key.replace(/^\/+/, '');
  if (config.aws.s3PublicUrl) {
    const baseUrl = config.aws.s3PublicUrl.replace(/\/+$/, '');
    return `${baseUrl}/${normalizedKey}`;
  }
  return `/${normalizedKey}`;
}
