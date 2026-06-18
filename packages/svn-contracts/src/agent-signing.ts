import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export function buildSignaturePayload(
  commandId: string,
  type: string,
  timestamp: string,
  payload: Record<string, unknown>,
): string {
  return `${commandId}\n${type}\n${timestamp}\n${JSON.stringify(payload)}`;
}

export function signAgentRequest(
  secret: string,
  commandId: string,
  type: string,
  timestamp: string,
  payload: Record<string, unknown>,
): string {
  const body = buildSignaturePayload(commandId, type, timestamp, payload);
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function verifyAgentSignature(
  secret: string,
  commandId: string,
  type: string,
  timestamp: string,
  payload: Record<string, unknown>,
  signature: string,
): boolean {
  const expected = signAgentRequest(secret, commandId, type, timestamp, payload);
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

export function isTimestampValid(timestamp: string, now = Date.now()): boolean {
  const ts = Date.parse(timestamp);
  if (Number.isNaN(ts)) return false;
  return Math.abs(now - ts) <= MAX_CLOCK_SKEW_MS;
}
