import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_STORAGE_SETTINGS } from '@gms-svn/shared';
import { runStorageConnectionTest } from './storage-connection-test.js';

test('connection test returns checks for all configured paths', async () => {
  const result = await runStorageConnectionTest(DEFAULT_STORAGE_SETTINGS);

  assert.ok(result.testedAt);
  assert.ok(result.testedFrom);
  assert.ok(['pass', 'warn', 'fail'].includes(result.overall));
  assert.equal(result.checks.length, 8);

  const ids = result.checks.map((c) => c.id);
  assert.ok(ids.includes('dns-server-host'));
  assert.ok(ids.includes('visualsvn-url'));
  assert.ok(ids.includes('repo-root'));
  assert.ok(ids.includes('storage-backup'));
  assert.ok(ids.includes('storage-backend'));
});

test('SMB backend selection yields warn on storage-backend check', async () => {
  const result = await runStorageConnectionTest({
    ...DEFAULT_STORAGE_SETTINGS,
    storageBackend: 'smb',
  });

  const backendCheck = result.checks.find((c) => c.id === 'storage-backend');
  assert.equal(backendCheck?.status, 'warn');
});
