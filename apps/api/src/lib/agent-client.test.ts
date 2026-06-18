import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AgentClient } from './agent-client.js';

test('mock agent creates repository', async () => {
  const client = new AgentClient({
    baseUrl: 'http://localhost:9999',
    hmacSecret: 'test',
    mock: true,
  });

  const result = await client.execute(
    'CreateRepository',
    { name: 'test-repo', layout: 'standard' },
    {
      commandId: '00000000-0000-4000-8000-000000000001',
      correlationId: '00000000-0000-4000-8000-000000000002',
      idempotencyKey: 'test-key-1',
    },
  );

  assert.equal(result.success, true);
  assert.match(result.stdout ?? '', /test-repo/);
});
