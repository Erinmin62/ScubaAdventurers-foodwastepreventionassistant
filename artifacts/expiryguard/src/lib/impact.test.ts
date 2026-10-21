import { test } from 'node:test';
import assert from 'node:assert/strict';
import { impactNumbers } from './impact';

const fixture = (): Parameters<typeof impactNumbers>[0] => ({
  summary: { estimatedSavings: 29.6, baselineWasteCost: 1001.3, actualWasteCost: 254, baselineWasteKg: 29.06, actualWasteKg: 7.5 },
  recommendations: [
    { type: 'purchase', status: 'pending', savings: 19.6 },
    { type: 'purchase', status: 'pending', savings: 7.68 },
    { type: 'purchase', status: 'approved', savings: 90 },
    { type: 'purchase', status: 'edited', savings: 8 },
    { type: 'purchase', status: 'rejected', savings: 100 },
    { type: 'preparation', status: 'pending', savings: 10 },
    { type: 'use-first', status: 'pending', savings: 15 },
    { type: 'purchase', status: 'pending', savings: -5 },
  ],
});
test('pending potential counts only positive pending purchases, not approved/rejected/other actions', () => {
  const n = impactNumbers(fixture());
  assert.equal(n.pendingPotential, 27.28);
  assert.equal(n.pendingCount, 2);
  assert.equal(n.approvedProjection, 29.6, 'not added to pending estimates');
});
test('recorded waste difference stays separate from purchasing and is rounded consistently', () => {
  const n = impactNumbers(fixture());
  assert.equal(n.wasteDelta, 747.3);
  assert.equal(n.kgDelta, 21.56);
  assert.equal(n.baselineCost, 1001.3);
  assert.equal(n.recentCost, 254);
});
test('a worse recent waste window produces a negative comparison, not claimed savings', () => {
  const input = fixture();
  input.summary.actualWasteCost = 1200;
  input.summary.actualWasteKg = 35;
  const n = impactNumbers(input);
  assert.equal(n.wasteDelta, -198.7);
  assert.equal(n.kgDelta, -5.94);
});
test('zero results and no pending purchases remain zero, with no invented impact', () => {
  const n = impactNumbers({ recommendations: [], summary: {
    estimatedSavings: 0, baselineWasteCost: 0, actualWasteCost: 0, baselineWasteKg: 0, actualWasteKg: 0,
  } });
  assert.equal(n.pendingPotential, 0);
  assert.equal(n.pendingCount, 0);
  assert.equal(n.approvedProjection, 0);
  assert.equal(n.wasteDelta, 0);
  assert.equal(n.kgDelta, 0);
});
