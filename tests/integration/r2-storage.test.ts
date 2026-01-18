import { describe, it, expect, afterAll } from '@jest/globals';
import { uploadDocument, getDocumentSignedUrl, deleteDocument } from '@/lib/storage';

describe('R2 Storage Integration', () => {
  const testKeys: string[] = [];

  afterAll(async () => {
    // Cleanup test files
    for (const key of testKeys) {
      try {
        await deleteDocument(key);
      } catch (error) {
        console.error(`Failed to cleanup ${key}:`, error);
      }
    }
  });

  it('should upload a document and return storage key', async () => {
    const testFile = Buffer.from('Test PDF content');

    const result = await uploadDocument({
      file: testFile,
      filename: 'test-document.pdf',
      mimeType: 'application/pdf',
      brokerId: 'test-broker-id',
    });

    expect(result.storageKey).toContain('test-broker-id/documents/');
    expect(result.filename).toBe('test-document.pdf');
    expect(result.sizeBytes).toBe(testFile.length);
    expect(result.mimeType).toBe('application/pdf');

    testKeys.push(result.storageKey);
  });

  it('should generate a signed URL for download', async () => {
    const testFile = Buffer.from('Test PDF content');

    const uploadResult = await uploadDocument({
      file: testFile,
      filename: 'test-download.pdf',
      mimeType: 'application/pdf',
      brokerId: 'test-broker-id',
    });

    testKeys.push(uploadResult.storageKey);

    const signedUrl = await getDocumentSignedUrl({
      storageKey: uploadResult.storageKey,
      expiresIn: 60,
    });

    expect(signedUrl).toContain('https://');
    expect(signedUrl).toContain(uploadResult.storageKey);
    expect(signedUrl).toContain('X-Amz-Signature');
  });

  it('should delete a document', async () => {
    const testFile = Buffer.from('Test PDF to delete');

    const uploadResult = await uploadDocument({
      file: testFile,
      filename: 'test-delete.pdf',
      mimeType: 'application/pdf',
      brokerId: 'test-broker-id',
    });

    await expect(deleteDocument(uploadResult.storageKey)).resolves.not.toThrow();
  });

  it('should upload with custom folder', async () => {
    const testFile = Buffer.from('Test attachment content');

    const result = await uploadDocument({
      file: testFile,
      filename: 'test-attachment.pdf',
      mimeType: 'application/pdf',
      brokerId: 'test-broker-id',
      folder: 'attachments',
    });

    expect(result.storageKey).toContain('test-broker-id/attachments/');

    testKeys.push(result.storageKey);
  });

  it('should generate signed URL with filename for download', async () => {
    const testFile = Buffer.from('Test PDF content');

    const uploadResult = await uploadDocument({
      file: testFile,
      filename: 'original-document.pdf',
      mimeType: 'application/pdf',
      brokerId: 'test-broker-id',
    });

    testKeys.push(uploadResult.storageKey);

    const signedUrl = await getDocumentSignedUrl({
      storageKey: uploadResult.storageKey,
      expiresIn: 60,
      filename: 'downloaded-document.pdf',
    });

    expect(signedUrl).toContain('https://');
    expect(signedUrl).toContain('response-content-disposition');
  });
});
