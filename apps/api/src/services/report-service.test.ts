import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeCsv, toCsv } from './report-service.js';

test('escapeCsv quotes fields with commas', () => {
  assert.equal(escapeCsv('hello'), 'hello');
  assert.equal(escapeCsv('a,b'), '"a,b"');
  assert.equal(escapeCsv('say "hi"'), '"say ""hi"""');
});

test('toCsv builds header and rows', () => {
  const csv = toCsv(['A', 'B'], [['1', '2'], ['x', null]]);
  assert.match(csv, /^A,B/);
  assert.match(csv, /1,2/);
});
