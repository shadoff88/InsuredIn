/**
 * Webhook Authentication Utilities
 *
 * Provides HMAC signature verification for webhook security.
 * Protects against unauthorized webhook calls and replay attacks.
 *
 * @see docs/sprint1/EMAIL_WEBHOOK_SECURITY.md
 */

interface VerifySignatureParams {
  signature: string;
  timestamp: string;
  body: ArrayBuffer;
  secret: string;
}

/**
 * Verify HMAC-SHA256 signature from Cloudflare Email Worker
 *
 * @param signature - Hex-encoded HMAC signature from X-Webhook-Signature header
 * @param timestamp - Unix timestamp in ms from X-Webhook-Timestamp header
 * @param body - Raw request body (ArrayBuffer)
 * @param secret - Webhook secret from environment variable
 * @returns True if signature is valid and timestamp is within acceptable range
 */
export async function verifyWebhookSignature({
  signature,
  timestamp,
  body,
  secret,
}: VerifySignatureParams): Promise<boolean> {
  try {
    // Validate timestamp (prevent replay attacks)
    if (!isTimestampValid(timestamp)) {
      console.warn(`Webhook timestamp out of range: ${timestamp}`);
      return false;
    }

    // Generate expected signature
    const expectedSignature = await generateHMAC(secret, body, timestamp);

    // Constant-time comparison to prevent timing attacks
    return timingSafeEqual(signature, expectedSignature);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Generate HMAC-SHA256 signature
 *
 * Algorithm:
 * 1. Concatenate timestamp + body
 * 2. Sign with HMAC-SHA256 using secret key
 * 3. Return hex-encoded signature
 *
 * @param secret - Webhook secret key
 * @param body - Request body as ArrayBuffer
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Hex-encoded HMAC signature
 */
async function generateHMAC(
  secret: string,
  body: ArrayBuffer,
  timestamp: string
): Promise<string> {
  const encoder = new TextEncoder();

  // Import secret as CryptoKey
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Create payload: timestamp + body bytes as string
  // Note: Convert ArrayBuffer to string representation for consistency
  const bodyStr = Array.from(new Uint8Array(body))
    .map(b => String.fromCharCode(b))
    .join('');
  const payload = timestamp + bodyStr;

  // Sign the payload
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );

  // Convert to hex string
  return Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validate timestamp is within acceptable range
 *
 * Prevents replay attacks by rejecting old or future timestamps.
 * Window: ±5 minutes (300,000 milliseconds)
 *
 * @param timestamp - Unix timestamp in milliseconds (as string)
 * @returns True if timestamp is within acceptable range
 */
function isTimestampValid(timestamp: string): boolean {
  const timestampMs = parseInt(timestamp, 10);

  if (isNaN(timestampMs)) {
    return false;
  }

  const now = Date.now();
  const diff = Math.abs(now - timestampMs);

  // Allow ±5 minutes
  const MAX_DIFF_MS = 5 * 60 * 1000; // 300,000 ms

  return diff <= MAX_DIFF_MS;
}

/**
 * Constant-time string comparison
 *
 * Prevents timing attacks by ensuring comparison takes the same time
 * regardless of where strings differ.
 *
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
