import { S3Client } from '@aws-sdk/client-s3';

let _r2Client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (_r2Client) {
    return _r2Client;
  }

  if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID is required');
  }
  if (!process.env.CLOUDFLARE_R2_ACCESS_KEY_ID) {
    throw new Error('CLOUDFLARE_R2_ACCESS_KEY_ID is required');
  }
  if (!process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY) {
    throw new Error('CLOUDFLARE_R2_SECRET_ACCESS_KEY is required');
  }

  _r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    },
  });

  return _r2Client;
}

export const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'insuredin-documents';
