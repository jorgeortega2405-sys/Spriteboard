import { config } from './env.config.js';
import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';

const s3ClientConfig: S3ClientConfig = {
  region: config.aws.region,
  forcePathStyle: config.aws.s3ForcePathStyle,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
};

if (config.aws.s3Endpoint) {
  s3ClientConfig.endpoint = config.aws.s3Endpoint;
}

export const s3Client = new S3Client(s3ClientConfig);
export const AWS_S3_BUCKET = config.aws.s3Bucket;
