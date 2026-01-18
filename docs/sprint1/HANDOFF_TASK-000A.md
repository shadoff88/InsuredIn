# Agent Handoff: TASK-000A

## Cloudflare R2 Bucket Setup

**From:** Overseer Agent  
**To:** DevOps Agent (Claude Code)  
**Date:** 2026-01-17  
**Priority:** P0 (BLOCKER)

---

## Context

The Email BCC Processing hero feature (Week 3-4) is code-complete but cannot function without document storage. Client document downloads (Week 5-6) also depend on this.

**Current State:**
- ✅ AI extraction code ready (`src/lib/ai/extract-document.ts`)
- ✅ Matching service ready (`src/lib/services/matching.ts`)
- ✅ Email inbox API routes ready
- ✅ Broker review UI ready
- ❌ **No document storage configured**

**Impact of Blocker:**
- Email attachments cannot be saved
- Documents cannot be served to clients
- PDF preview in broker review screen won't work

---

## Task Definition

Set up Cloudflare R2 bucket with S3-compatible API access for document storage.

---

## Acceptance Criteria

### Cloudflare Dashboard
- [ ] R2 bucket created: `insuredin-documents`
- [ ] API token created with R2 read/write permissions
- [ ] Note Account ID for configuration

### CORS Configuration
- [ ] CORS policy allows requests from:
  - `https://insuredin.vercel.app`
  - `https://*.insuredin.app` (for white-label subdomains)
  - `http://localhost:3000` (development)
- [ ] Allowed methods: GET, PUT, HEAD
- [ ] Max age: 3600 seconds

### Environment Variables (Vercel)
- [ ] `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- [ ] `CLOUDFLARE_R2_ACCESS_KEY_ID` - R2 API token ID
- [ ] `CLOUDFLARE_R2_SECRET_ACCESS_KEY` - R2 API token secret
- [ ] `CLOUDFLARE_R2_BUCKET_NAME` - `insuredin-documents`
- [ ] `CLOUDFLARE_R2_PUBLIC_URL` - (optional, for custom domain)

### Codebase Implementation
- [ ] Install dependencies: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
- [ ] Create R2 client utility
- [ ] Create upload function (returns storage key)
- [ ] Create signed URL function (for secure downloads)
- [ ] Create delete function (for cleanup)
- [ ] Add integration test

### Verification
- [ ] Upload test PDF via code
- [ ] Generate signed URL
- [ ] Download via signed URL works
- [ ] URL expires after timeout
- [ ] Direct bucket access blocked (no public access)

---

## Files to Create

```
src/lib/storage/
├── r2-client.ts           # S3-compatible client instance
├── upload-document.ts     # Upload file, return storage key
├── get-signed-url.ts      # Generate time-limited download URL
├── delete-document.ts     # Remove file from storage
└── index.ts               # Barrel export

src/lib/types/
└── storage.ts             # Type definitions

tests/integration/
└── r2-storage.test.ts     # Integration tests
```

---

## Implementation Guide

### 1. Install Dependencies

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### 2. Environment Variables Schema

Add to `.env.local` (and Vercel dashboard):

```env
# Cloudflare R2 Configuration
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key_id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_access_key
CLOUDFLARE_R2_BUCKET_NAME=insuredin-documents
```

### 3. R2 Client (`src/lib/storage/r2-client.ts`)

```typescript
import { S3Client } from '@aws-sdk/client-s3';

if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
  throw new Error('CLOUDFLARE_ACCOUNT_ID is required');
}
if (!process.env.CLOUDFLARE_R2_ACCESS_KEY_ID) {
  throw new Error('CLOUDFLARE_R2_ACCESS_KEY_ID is required');
}
if (!process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY) {
  throw new Error('CLOUDFLARE_R2_SECRET_ACCESS_KEY is required');
}

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

export const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'insuredin-documents';
```

### 4. Upload Function (`src/lib/storage/upload-document.ts`)

```typescript
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET_NAME } from './r2-client';
import { randomUUID } from 'crypto';

interface UploadOptions {
  file: Buffer;
  filename: string;
  mimeType: string;
  brokerId: string;
  folder?: 'documents' | 'attachments' | 'claims';
}

interface UploadResult {
  storageKey: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

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
```

### 5. Signed URL Function (`src/lib/storage/get-signed-url.ts`)

```typescript
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client, R2_BUCKET_NAME } from './r2-client';

interface SignedUrlOptions {
  storageKey: string;
  expiresIn?: number; // seconds, default 3600 (1 hour)
  filename?: string;  // for Content-Disposition header
}

export async function getDocumentSignedUrl(options: SignedUrlOptions): Promise<string> {
  const { storageKey, expiresIn = 3600, filename } = options;
  
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: storageKey,
    ...(filename && {
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    }),
  });
  
  const signedUrl = await getSignedUrl(r2Client, command, { expiresIn });
  
  return signedUrl;
}
```

### 6. Delete Function (`src/lib/storage/delete-document.ts`)

```typescript
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET_NAME } from './r2-client';

export async function deleteDocument(storageKey: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: storageKey,
  });
  
  await r2Client.send(command);
}
```

### 7. Barrel Export (`src/lib/storage/index.ts`)

```typescript
export { r2Client, R2_BUCKET_NAME } from './r2-client';
export { uploadDocument } from './upload-document';
export { getDocumentSignedUrl } from './get-signed-url';
export { deleteDocument } from './delete-document';
```

### 8. Type Definitions (`src/lib/types/storage.ts`)

```typescript
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
```

### 9. Integration Test (`tests/integration/r2-storage.test.ts`)

```typescript
import { describe, it, expect, afterAll } from '@jest/globals';
import { uploadDocument, getDocumentSignedUrl, deleteDocument } from '@/lib/storage';

describe('R2 Storage Integration', () => {
  const testKeys: string[] = [];
  
  afterAll(async () => {
    // Cleanup test files
    for (const key of testKeys) {
      await deleteDocument(key);
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
    expect(result.sizeBytes).toBe(testFile.length);
    
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
});
```

---

## Cloudflare Dashboard Steps

### Step 1: Create R2 Bucket
1. Log in to Cloudflare Dashboard
2. Select your account
3. Go to **R2 Object Storage** in sidebar
4. Click **Create bucket**
5. Name: `insuredin-documents`
6. Location hint: Choose nearest to your users (e.g., Asia-Pacific for NZ)
7. Click **Create bucket**

### Step 2: Create API Token
1. In R2, go to **Manage R2 API Tokens**
2. Click **Create API token**
3. Token name: `insuredin-app-access`
4. Permissions: **Object Read & Write**
5. Specify bucket: `insuredin-documents`
6. TTL: No expiration (or set appropriate expiry)
7. Click **Create API Token**
8. **COPY the Access Key ID and Secret Access Key immediately** (shown only once)

### Step 3: Get Account ID
1. Go to any Cloudflare page
2. Look at URL: `https://dash.cloudflare.com/[ACCOUNT_ID]/...`
3. Or find in **Account Home** > **Account ID** on right sidebar

### Step 4: Configure CORS (via API)
```bash
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/{account_id}/r2/buckets/insuredin-documents/cors" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '[
    {
      "AllowedOrigins": ["https://insuredin.vercel.app", "https://*.insuredin.app", "http://localhost:3000"],
      "AllowedMethods": ["GET", "PUT", "HEAD"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600
    }
  ]'
```

### Step 5: Add Environment Variables to Vercel
1. Go to Vercel Dashboard > InsuredIn project
2. Settings > Environment Variables
3. Add each variable for **Production**, **Preview**, and **Development**:
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_R2_ACCESS_KEY_ID`
   - `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
   - `CLOUDFLARE_R2_BUCKET_NAME`

---

## Verification Checklist

After implementation, verify:

```bash
# Run integration tests
npm run test -- tests/integration/r2-storage.test.ts

# Manual verification
# 1. Upload should succeed
# 2. Signed URL should return valid URL
# 3. Accessing signed URL should download file
# 4. Direct bucket URL without signature should fail (403)
```

---

## Dependencies on This Task

| Blocked Task | Reason |
|--------------|--------|
| TASK-000B (Email Worker) | Needs R2 to save attachments |
| TASK-007 (Document Library) | Needs R2 for signed URLs |
| TASK-008 (Documents API) | Needs R2 for downloads |
| Broker Review PDF Preview | Needs R2 signed URLs |

---

## Questions / Decisions

1. **Bucket naming convention?**  
   Recommendation: Single bucket `insuredin-documents` with folder structure per broker

2. **Signed URL expiry?**  
   Recommendation: 1 hour for viewing, 5 minutes for uploads

3. **File size limits?**  
   Recommendation: 25MB max (covers most policy documents)

4. **Lifecycle rules?**  
   Consider: Auto-delete files older than 7 years (regulatory requirement)

---

## Success Criteria

- [ ] R2 bucket exists and accessible via API
- [ ] Environment variables configured in Vercel
- [ ] Storage utility functions implemented
- [ ] Integration tests passing
- [ ] Manual upload/download test successful
- [ ] No public access to bucket contents

---

**Handoff Complete**

Once TASK-000A is done, proceed to TASK-000B (Email Worker) which depends on R2 being available.

Report back with:
- Bucket created? ✓/✗
- API tokens working? ✓/✗
- Tests passing? ✓/✗
- Any blockers encountered?
