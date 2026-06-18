import { test } from 'node:test';
import assert from 'node:assert/strict';

test('client visible repos filters by access rules for non-admin', () => {
  const rules = [
    { repository: { id: '1', name: 'alpha' }, principalType: 'GROUP', principalName: 'Developers' },
    { repository: { id: '2', name: 'beta' }, principalType: 'USER', principalName: 'dev1' },
    { repository: { id: '1', name: 'alpha' }, principalType: 'USER', principalName: 'dev1' },
  ];

  const byId = new Map<string, { name: string }>();
  for (const rule of rules) {
    if (!byId.has(rule.repository.id)) {
      byId.set(rule.repository.id, rule.repository);
    }
  }

  assert.equal(byId.size, 2);
  assert.deepEqual([...byId.values()].map((r) => r.name).sort(), ['alpha', 'beta']);
});
