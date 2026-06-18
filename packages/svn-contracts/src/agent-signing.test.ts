import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { signAgentRequest, verifyAgentSignature, isTimestampValid } from './agent-signing.js';

test('HMAC sign and verify round-trip', () => {
  const secret = 'test-secret-min-32-characters-long';
  const commandId = randomUUID();
  const type = 'CreateRepository';
  const timestamp = new Date().toISOString();
  const payload = { name: 'demo-repo', layout: 'standard' };

  const signature = signAgentRequest(secret, commandId, type, timestamp, payload);
  assert.equal(signature.length, 64);
  assert.ok(verifyAgentSignature(secret, commandId, type, timestamp, payload, signature));
});

test('rejects tampered signature', () => {
  const secret = 'test-secret-min-32-characters-long';
  const commandId = randomUUID();
  const timestamp = new Date().toISOString();
  const payload = { name: 'demo-repo' };
  const signature = signAgentRequest(secret, commandId, 'CreateRepository', timestamp, payload);
  assert.ok(!verifyAgentSignature(secret, commandId, 'CreateRepository', timestamp, payload, 'a'.repeat(64)));
  assert.ok(signature !== 'a'.repeat(64));
});

test('timestamp validation window', () => {
  const now = new Date().toISOString();
  assert.ok(isTimestampValid(now));
  const old = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  assert.ok(!isTimestampValid(old));
});
