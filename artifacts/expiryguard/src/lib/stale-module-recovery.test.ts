import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claimRecovery, isStaleModuleError } from './stale-module-recovery';

test('recognizes stale React runtime and module-loading failures', () => {
  for (const message of [
    "Cannot read properties of null (reading 'useState')",
    "Cannot read properties of null (reading 'useContext')",
    'Invalid hook call. Hooks can only be called inside of the body of a function component.',
    'Failed to fetch dynamically imported module: /src/pages/dashboard.tsx',
    'Outdated Optimize Dep',
  ]) assert.equal(isStaleModuleError(new Error(message)), true, message);
});
test('does not auto-reload ordinary application errors', () => {
  for (const message of [
    "Cannot read properties of undefined (reading 'followUps')",
    "Cannot read properties of null (reading 'name')",
    'Failed to save outcome',
  ]) assert.equal(isStaleModuleError(new Error(message)), false);
});
test('recovery is rate-limited across reloads and permits a later recovery', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  assert.equal(claimRecovery(storage, 100_000), true);
  assert.equal(claimRecovery(storage, 100_001), false);
  assert.equal(claimRecovery(storage, 159_999), false);
  assert.equal(claimRecovery(storage, 160_001), true);
});
test('blocked storage leaves manual recovery available without throwing', () => {
  const storage = { getItem: () => { throw new Error('Storage blocked'); }, setItem: () => {} };
  assert.equal(claimRecovery(storage, 100_000), false);
});
