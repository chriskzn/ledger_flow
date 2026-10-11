import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPermission, isKeyExpired } from '../supabase/functions/ledgerflow-api/permissions.ts';
test('read-only keys cannot mutate resources', () => {
  assert.equal(hasPermission(['read'], 'read'), true);
  assert.equal(hasPermission(['read'], 'write'), false);
  assert.equal(hasPermission(['write'], 'read'), false);
});
test('admin keys can read/write, missing permissions deny', () => {
  assert.equal(hasPermission(['admin'], 'write'), true);
  assert.equal(hasPermission([], 'read'), false);
  assert.equal(hasPermission(null, 'read'), false);
});
test('expired and malformed key expiry rejected', () => {
  assert.equal(isKeyExpired('2026-01-01T00:00:00Z', Date.parse('2026-10-11T00:00:00Z')), true);
  assert.equal(isKeyExpired('not-a-date'), true);
  assert.equal(isKeyExpired(null), false);
});
