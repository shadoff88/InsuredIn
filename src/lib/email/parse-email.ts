import { simpleParser, ParsedMail, Attachment } from 'mailparser';

export interface ParsedEmailData {
  from: string;
  to: string[];
  subject: string;
  textBody: string;
  htmlBody: string;
  attachments: EmailAttachment[];
  headers: Record<string, string>;
  receivedAt: Date;
}

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  content: Buffer;
  size: number;
}

/**
 * Parse raw email (RFC 822 format) into structured data
 * @param rawEmail - Raw email string or buffer
 * @returns Parsed email data
 */
export async function parseEmail(rawEmail: string | Buffer): Promise<ParsedEmailData> {
  const parsed: ParsedMail = await simpleParser(rawEmail);

  const attachments: EmailAttachment[] = parsed.attachments.map((att: Attachment) => ({
    filename: att.filename || 'attachment',
    mimeType: att.contentType,
    content: att.content,
    size: att.size,
  }));

  const fromAddresses = parsed.from && (Array.isArray(parsed.from) ? parsed.from : [parsed.from]);
  const fromAddress = fromAddresses && fromAddresses.length > 0 ? fromAddresses[0].text || '' : '';

  const toAddresses = parsed.to && (Array.isArray(parsed.to) ? parsed.to : [parsed.to]);
  const toList = toAddresses ? toAddresses.map(addr => addr.text || '') : [];

  return {
    from: fromAddress,
    to: toList,
    subject: parsed.subject || '',
    textBody: parsed.text || '',
    htmlBody: parsed.html || '',
    attachments,
    headers: Object.fromEntries(
      Array.from(parsed.headers).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(', ') : String(value),
      ])
    ),
    receivedAt: parsed.date || new Date(),
  };
}

/**
 * Extract broker ID from destination email address
 * Format: documents@broker-{broker_id}.insuredin.app
 * Or subdomain format: documents@{subdomain}.insuredin.app
 * @param toEmail - Destination email address
 * @returns Broker ID or null
 */
export function extractBrokerIdFromEmail(toEmail: string): string | null {
  // Pattern 1: documents@broker-{uuid}.insuredin.app
  const brokerIdMatch = toEmail.match(/documents@broker-([a-f0-9-]+)\.insuredin\.app/i);
  if (brokerIdMatch) {
    return brokerIdMatch[1];
  }

  // Pattern 2: documents@{subdomain}.insuredin.app (will need to look up in database)
  const subdomainMatch = toEmail.match(/documents@([a-z0-9-]+)\.insuredin\.app/i);
  if (subdomainMatch) {
    return subdomainMatch[1]; // Return subdomain for database lookup
  }

  return null;
}

/**
 * Extract broker UID from destination email address (NEW FORMAT)
 * Format: {broker_uid}@{brokerage_name}.insuredin.app
 *
 * @example
 * extractBrokerUidFromEmail('broker-abc123@smithinsurance.insuredin.app')
 * // Returns: 'broker-abc123'
 *
 * @param toEmail - Destination email address
 * @returns Broker UID (UUID format) or null if invalid format
 */
export function extractBrokerUidFromEmail(toEmail: string): string | null {
  // Pattern: {broker_uid}@{subdomain}.insuredin.app
  // broker_uid should be a valid UUID format
  const match = toEmail.match(/^([a-f0-9-]+)@([a-z0-9-]+)\.insuredin\.app$/i);

  if (!match) {
    return null;
  }

  const brokerUid = match[1];

  // Validate UUID format (loose validation)
  // UUID pattern: 8-4-4-4-12 hex characters with dashes
  const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

  if (uuidPattern.test(brokerUid)) {
    return brokerUid;
  }

  // Also accept "broker-{uuid}" format for backwards compatibility
  const brokerPrefixPattern = /^broker-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;
  const brokerPrefixMatch = brokerUid.match(brokerPrefixPattern);

  if (brokerPrefixMatch) {
    return brokerPrefixMatch[1]; // Return UUID without "broker-" prefix
  }

  return null;
}

/**
 * Validate that email contains PDF attachments
 * @param attachments - List of email attachments
 * @returns True if at least one PDF found
 */
export function hasPdfAttachments(attachments: EmailAttachment[]): boolean {
  return attachments.some((att) =>
    att.mimeType.toLowerCase().includes('pdf') ||
    att.filename.toLowerCase().endsWith('.pdf')
  );
}

/**
 * Filter attachments to only PDF files
 * @param attachments - List of email attachments
 * @returns PDF attachments only
 */
export function filterPdfAttachments(attachments: EmailAttachment[]): EmailAttachment[] {
  return attachments.filter((att) =>
    att.mimeType.toLowerCase().includes('pdf') ||
    att.filename.toLowerCase().endsWith('.pdf')
  );
}
