import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET_NAME } from './r2-client';
import { randomUUID } from 'crypto';
import type { UploadOptions, UploadResult } from '../types/storage';

export async function uploadDocument(options: UploadOptions): Promise<UploadResult> {
  const { file, filename, mimeType, brokerId, folder = 'documents' } = options;

  // Generate unique storage key: broker_id/folder/uuid_filename
  const fileExtension = filename.split('.').pop() || 'pdf';
  const uniqueId = randomUUID();
  const storageKey = `${brokerId}/${folder}/${uniqueId}.${fileExtension}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: storageKey,
    Body: file,
    ContentType: mimeType,
    Metadata: {
      'original-filename': filename,
      'broker-id': brokerId,
      'uploaded-at': new Date().toISOString(),
    },
  });

  await r2Client.send(command);

  return {
    storageKey,
    filename,
    sizeBytes: file.length,
    mimeType,
  };
}
