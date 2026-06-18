import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCT_NAMES } from '@gms-svn/shared';

test('health response shape', () => {
  const response = {
    status: 'ok',
    service: PRODUCT_NAMES.webAdmin,
    server: PRODUCT_NAMES.server,
    client: PRODUCT_NAMES.client,
    phase: 9,
    checks: { database: 'ok' },
    timestamp: new Date().toISOString(),
  };

  assert.equal(response.service, 'GMS SVN Web Admin');
  assert.equal(response.server, 'GMS SVN SERVER');
  assert.equal(response.client, 'GMS SVN CLIENT');
  assert.ok(['ok', 'degraded'].includes(response.status));
});
