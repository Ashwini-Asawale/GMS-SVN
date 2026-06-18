import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signPipelinePayload, verifyPipelineSignature } from './pipeline-service.js';

test('pipeline signature round-trip', () => {
  const body = JSON.stringify({ repositoryName: 'My-Repo', revision: 42 });
  const sig = signPipelinePayload('test-secret', body);
  assert.equal(verifyPipelineSignature('test-secret', body, sig), true);
  assert.equal(verifyPipelineSignature('wrong', body, sig), false);
});
