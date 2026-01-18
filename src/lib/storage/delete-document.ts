import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, R2_BUCKET_NAME } from './r2-client';

export async function deleteDocument(storageKey: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: storageKey,
  });

  const client = getR2Client();
  await client.send(command);
}
