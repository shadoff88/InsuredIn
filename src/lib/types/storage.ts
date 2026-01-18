export interface StorageDocument {
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
}

export interface SignedUrlResult {
  url: string;
  expiresAt: Date;
}

export interface UploadOptions {
  file: Buffer;
  filename: string;
  mimeType: string;
  brokerId: string;
  folder?: 'documents' | 'attachments' | 'claims';
}

export interface UploadResult {
  storageKey: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

export interface SignedUrlOptions {
  storageKey: string;
  expiresIn?: number; // seconds, default 3600 (1 hour)
  filename?: string;  // for Content-Disposition header
}
