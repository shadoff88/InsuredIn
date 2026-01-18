import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getR2Client, R2_BUCKET_NAME } from './r2-client';
import type { SignedUrlOptions } from '../types/storage';

export async function getDocumentSignedUrl(options: SignedUrlOptions): Promise<string> {
  const { storageKey, expiresIn = 3600, filename } = options;

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: storageKey,
    ...(filename && {
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    }),
  });

  const client = getR2Client();
  const signedUrl = await getSignedUrl(client, command, { expiresIn });

  return signedUrl;
}
