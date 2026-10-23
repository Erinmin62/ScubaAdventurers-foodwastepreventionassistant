import { test } from 'node:test';
import assert from 'node:assert/strict';
import { impactNumbers, wasteHistoryComparison } from './impact.ts';

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

test('owner waste comparison sums adjacent seven-day windows without filling missing dates with zero', () => {
  const result = wasteHistoryComparison([
    { date: '2026-01-02', leftover: 3, menuCost: 4 },
    { date: '2026-01-07', leftover: 2, menuCost: 5 },
    { date: '2026-01-08', leftover: 1, menuCost: 4 },
    { date: '2026-01-14', leftover: 2, menuCost: 6 },
    { date: '2026-01-15', leftover: 100, menuCost: 1 },
  ], '2026-01-14');
  assert.deepEqual(result, {
    earlier: {
      from: '2026-01-01', through: '2026-01-07', rows: 2, recordedDays: 2,
      leftoverPortions: 5, leftoverCost: 22, costRows: 2,
    },
    recent: {
      from: '2026-01-08', through: '2026-01-14', rows: 2, recordedDays: 2,
      leftoverPortions: 3, leftoverCost: 16, costRows: 2,
    },
    portionDelta: 2,
    costDelta: 6,
  });
});

test('owner waste comparison does not invent zero outcomes when either window has no records', () => {
  const empty = wasteHistoryComparison([], '2026-01-14');
  assert.equal(empty.earlier.leftoverCost, null);
  assert.equal(empty.recent.leftoverCost, null);
  assert.equal(empty.portionDelta, null);
  assert.equal(empty.costDelta, null);

  const oneWindow = wasteHistoryComparison([
    { date: '2026-01-14', leftover: 0, menuCost: 6 },
  ], '2026-01-14');
  assert.equal(oneWindow.recent.rows, 1);
  assert.equal(oneWindow.recent.leftoverPortions, 0, 'explicitly recorded zero remains a valid observation');
  assert.equal(oneWindow.portionDelta, null, 'the missing earlier window is unknown, not zero');
});

test('leftover quantity remains comparable when saved per-portion cost is incomplete', () => {
  const result = wasteHistoryComparison([
    { date: '2026-01-01', leftover: 4, menuCost: 5 },
    { date: '2026-01-14', leftover: 2 },
  ], '2026-01-14');
  assert.equal(result.portionDelta, 2);
  assert.equal(result.earlier.leftoverCost, 20);
  assert.equal(result.recent.leftoverCost, null);
  assert.equal(result.recent.costRows, 0);
  assert.equal(result.costDelta, null);
});
