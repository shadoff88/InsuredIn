# 3. API Specification

## Overview

InsuredIn uses Next.js API Routes for all backend functionality. All endpoints require authentication unless otherwise noted.

---

## Authentication Endpoints

### POST /api/auth/broker/register
Create a new broker account.

**Request Body:**
```json
{
  "email": "broker@company.com",
  "password": "securePassword123",
  "companyName": "Auckland Brokerage Ltd",
  "fullName": "John Smith"
}
```

**Response (201):**
```json
{
  "success": true,
  "user": { "id": "uuid", "email": "broker@company.com" },
  "broker": { "id": "uuid", "companyName": "Auckland Brokerage Ltd" }
}
```

---

### POST /api/auth/broker/login
Authenticate as a broker user.

**Request Body:**
```json
{
  "email": "broker@company.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "broker@company.com",
    "fullName": "John Smith",
    "role": "admin"
  },
  "broker": {
    "id": "uuid",
    "companyName": "Auckland Brokerage Ltd"
  }
}
```

---

### POST /api/auth/client/register
Register a client using an invite code.

**Request Body:**
```json
{
  "inviteCode": "ABC123XYZ789",
  "password": "clientPassword123",
  "confirmPassword": "clientPassword123"
}
```

**Response (201):**
```json
{
  "success": true,
  "user": { "id": "uuid", "email": "client@example.com" },
  "client": { "id": "uuid", "fullName": "Jane Doe" }
}
```

---

### POST /api/auth/client/login
Authenticate as a client user.

**Request Body:**
```json
{
  "email": "client@example.com",
  "password": "clientPassword123"
}
```

---

### POST /api/auth/logout
Sign out the current user.

**Response (200):**
```json
{ "success": true }
```

---

## Broker Endpoints

### GET /api/broker/clients
List all clients for the authenticated broker.

**Response (200):**
```json
{
  "clients": [
    {
      "id": "uuid",
      "full_name": "John Smith",
      "client_number": "AKL-12345",
      "email": "john@example.com",
      "phone": "+64 21 123 4567"
    }
  ]
}
```

---

### POST /api/broker/clients/invite
Create an invite for a client to register.

**Request Body:**
```json
{
  "clientId": "uuid"
}
```

**Response (200):**
```json
{
  "success": true,
  "invite": {
    "code": "ABC123XYZ789",
    "expiresAt": "2026-01-22T00:00:00Z",
    "inviteUrl": "https://insuredin.vercel.app/invite?code=ABC123XYZ789"
  },
  "client": {
    "id": "uuid",
    "fullName": "John Smith",
    "email": "john@example.com"
  }
}
```

---

### GET /api/broker/clients/[clientId]/policies
Get all policies for a specific client.

**Response (200):**
```json
{
  "policies": [
    {
      "id": "uuid",
      "policy_number": "DPK-5719028",
      "insurer": "Vero Insurance",
      "policy_type": "home",
      "status": "active",
      "period_start": "2025-09-01",
      "period_end": "2026-09-01"
    }
  ]
}
```

---

## Email BCC Processing Endpoints

### GET /api/broker/email-inbox
List email processing transactions.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| status | string | "all" | Filter by status: pending, awaiting_review, approved, rejected, error, all |
| limit | number | 50 | Maximum results to return |
| offset | number | 0 | Pagination offset |

**Response (200):**
```json
{
  "transactions": [
    {
      "id": "uuid",
      "from_email": "underwriting@vero.co.nz",
      "to_email": "documents@broker.insuredin.app",
      "subject": "Policy Schedule - DPK-5719028",
      "received_at": "2026-01-15T10:30:00Z",
      "status": "awaiting_review",
      "extracted_client_number": "AKL-12345",
      "extracted_policy_number": "DPK-5719028",
      "extracted_document_type": "policy_schedule",
      "ai_overall_confidence": 0.97,
      "match_confidence": 0.96,
      "clients": {
        "id": "uuid",
        "full_name": "John Smith",
        "client_number": "AKL-12345"
      },
      "policies": {
        "id": "uuid",
        "policy_number": "DPK-5719028",
        "insurer": "Vero Insurance"
      },
      "email_attachments": [
        {
          "id": "uuid",
          "filename": "policy_schedule.pdf",
          "mime_type": "application/pdf",
          "size_bytes": 245000
        }
      ]
    }
  ],
  "total": 42,
  "counts": {
    "all": 42,
    "pending": 2,
    "awaiting_review": 5,
    "approved": 30,
    "rejected": 3,
    "error": 2
  }
}
```

---

### GET /api/broker/email-inbox/[id]
Get details of a specific email transaction.

**Response (200):**
```json
{
  "transaction": {
    "id": "uuid",
    "from_email": "underwriting@vero.co.nz",
    "to_email": "documents@broker.insuredin.app",
    "subject": "Policy Schedule - DPK-5719028",
    "received_at": "2026-01-15T10:30:00Z",
    "status": "awaiting_review",
    "extracted_client_number": "AKL-12345",
    "extracted_policy_number": "DPK-5719028",
    "extracted_document_type": "policy_schedule",
    "ai_confidence": {
      "client_number": 0.95,
      "policy_number": 0.98,
      "document_type": 0.99
    },
    "ai_overall_confidence": 0.97,
    "suggested_client_id": "uuid",
    "suggested_policy_id": "uuid",
    "match_confidence": 0.96,
    "clients": { ... },
    "policies": { ... },
    "email_attachments": [
      {
        "id": "uuid",
        "filename": "policy_schedule.pdf",
        "mime_type": "application/pdf",
        "size_bytes": 245000,
        "storage_url": "https://storage.example.com/..."
      }
    ]
  }
}
```

---

### POST /api/broker/email-inbox/[id]/approve
Approve or reject an email transaction.

**Request Body (Approve):**
```json
{
  "approved": true,
  "clientId": "uuid",
  "policyId": "uuid",
  "documentType": "policy_schedule",
  "correctionReason": "Changed document type from invoice to policy schedule"
}
```

**Request Body (Reject):**
```json
{
  "approved": false,
  "correctionReason": "Duplicate document, already uploaded"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Document approved and published",
  "documentsCreated": 1
}
```

---

## AI Extraction

### Document Extraction Fields

The Claude AI extracts the following fields from documents:

| Field | Description | Example |
|-------|-------------|---------|
| clientNumber | Client identifier | "AKL-12345", "CL-9876" |
| policyNumber | Policy reference | "DPK-5719028", "POL-ABC123" |
| documentType | Type classification | policy_schedule, invoice, certificate |
| insurer | Insurance company | "Vero Insurance", "AA Insurance" |

### Confidence Scoring

Each extracted field includes a confidence score (0.0 - 1.0):
- **0.9 - 1.0**: High confidence (green)
- **0.7 - 0.9**: Medium confidence (yellow)
- **0.0 - 0.7**: Low confidence (red)

### Matching Logic

The system matches documents to clients/policies using priority-based logic:

1. **Priority 1 (98% confidence)**: Both client_number AND policy_number match
2. **Priority 2 (85% confidence)**: Policy number only matches
3. **Priority 3 (80% confidence)**: Client number only matches
4. **No Match (0%)**: Manual selection required

### Learning Feedback

When a broker approves/rejects:
- `ai_suggestion_correct`: Boolean indicating if AI was right
- `broker_correction_reason`: Text explaining any corrections

This data is used to track AI accuracy over time.

---

## Error Responses

All endpoints return consistent error responses:

**400 Bad Request:**
```json
{ "error": "Validation error message" }
```

**401 Unauthorized:**
```json
{ "error": "Unauthorized" }
```

**403 Forbidden:**
```json
{ "error": "Not a broker user" }
```

**404 Not Found:**
```json
{ "error": "Resource not found" }
```

**500 Internal Server Error:**
```json
{ "error": "An unexpected error occurred" }
```

---

## Rate Limits

- Authentication endpoints: 10 requests/minute
- API endpoints: 100 requests/minute
- Claude AI extraction: Subject to Anthropic API limits

---

**Version:** 1.0
**Last Updated:** January 2026
