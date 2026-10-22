import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateForecastHistory } from './forecast-evaluation.ts';

type History = Parameters<typeof evaluateForecastHistory>[0];
type Evaluation = ReturnType<typeof evaluateForecastHistory>;

// Fixed UTC calendar dates, independent of the machine's date and timezone.
function date(day: number) {
  return new Date(Date.UTC(2026, 0, day)).toISOString().slice(0, 10);
}

function fixture(days = 8, menuIds = ['a']): History {
  const state: History = {
    menu: menuIds.map((id) => ({
      id, name: id, description: '', price: 10, cost: 5, archivedAt: null, recipe: [],
    })),
    sales: [],
    results: [],
  };
  for (let day = 1; day <= days; day++) {
    for (const menuId of menuIds) {
      state.sales.push({ date: date(day), menuId, portions: 100 });
      state.results.push({ date: date(day), menuId, prepared: 120, sold: 100, leftover: 20 });
    }
  }
  return state;
}

function assertCoverage(evaluation: Evaluation, from: string | null, through: string | null, days: number, samples: number) {
  assert.equal(evaluation.testedFrom, from);
  assert.equal(evaluation.testedThrough, through);
  assert.equal(evaluation.heldOutDays, days);
  for (const measure of [evaluation.sales, evaluation.waste]) {
    assert.equal(measure.rules.observations, samples);
    assert.equal(measure.priorWeek.observations, samples);
  }
}

function assertEmpty(state: History) {
  const result = evaluateForecastHistory(state);
  assertCoverage(result, null, null, 0, 0);
  for (const measure of [result.sales, result.waste]) {
    for (const score of [measure.rules, measure.priorWeek]) {
      assert.deepEqual(score, { mae: 0, wape: null, observations: 0 });
    }
  }
}

test('one complete window scores only its held-out date with exact errors', () => {
  const result = evaluateForecastHistory(fixture());
  assertCoverage(result, date(8), date(8), 1, 1);
  assert.deepEqual(result.sales, {
    rules: { mae: 3, wape: 3, observations: 1 },
    priorWeek: { mae: 0, wape: 0, observations: 1 },
  });
  assert.deepEqual(result.waste, {
    rules: { mae: 1, wape: 5, observations: 1 },
    priorWeek: { mae: 0, wape: 0, observations: 1 },
  });
});

test('every rolling prediction uses only the preceding seven calendar days', () => {
  const state = fixture(14);
  state.sales.forEach((row, index) => { row.portions = (index + 1) * 100; });
  state.results.forEach((row, index) => { row.leftover = (index + 1) * 10; });
  const result = evaluateForecastHistory(state);
  assertCoverage(result, date(8), date(14), 7, 7);
  // Jan 8–14: predictions are 388, 485, 690, 805, 776, 873, 970.
  // Waste predictions are 39, 49, 69, 81, 78, 87, 97 (rounded separately).
  assert.deepEqual(result.sales, {
    rules: { mae: 2713 / 7, wape: 2713 / 7700 * 100, observations: 7 },
    priorWeek: { mae: 700, wape: 4900 / 7700 * 100, observations: 7 },
  });
  assert.deepEqual(result.waste, {
    rules: { mae: 270 / 7, wape: 270 / 770 * 100, observations: 7 },
    priorWeek: { mae: 70, wape: 490 / 770 * 100, observations: 7 },
  });
});

test('held-out spikes and later records cannot influence their own predictions', () => {
  const state = fixture();
  state.sales.at(-1)!.portions = 1000;
  state.results.at(-1)!.leftover = 200;
  // This future dish-day is incomplete, so it cannot add a scored observation.
  state.sales.push({ date: date(9), menuId: 'a', portions: 1_000_000 });
  state.results.push({ date: date(10), menuId: 'a', prepared: 1_000_000, sold: 0, leftover: 1_000_000 });
  const result = evaluateForecastHistory(state);
  assertCoverage(result, date(8), date(8), 1, 1);
  assert.deepEqual(result.sales, {
    rules: { mae: 903, wape: 90.3, observations: 1 },
    priorWeek: { mae: 900, wape: 90, observations: 1 },
  });
  assert.deepEqual(result.waste, {
    rules: { mae: 181, wape: 90.5, observations: 1 },
    priorWeek: { mae: 180, wape: 90, observations: 1 },
  });
});

for (const source of ['sales', 'results'] as const) {
  for (let missingDay = 1; missingDay <= 8; missingDay++) {
    test(`missing ${source} on ${date(missingDay)} excludes that dish, not the complete dish`, () => {
      const state = fixture(8, ['a', 'b']);
      if (source === 'sales') {
        state.sales = state.sales.filter((row) => row.menuId !== 'a' || row.date !== date(missingDay));
      } else {
        state.results = state.results.filter((row) => row.menuId !== 'a' || row.date !== date(missingDay));
      }
      // Dish b remains complete. Missing prior-week, intermediate training, or
      // held-out values for a must never be silently converted to zero.
      assert.deepEqual(evaluateForecastHistory(state), evaluateForecastHistory(fixture(8, ['b'])));
    });
  }
}

test('a missing calendar day is not replaced by an older available record', () => {
  const state = fixture(9);
  state.sales = state.sales.filter((row) => row.date !== date(2));
  state.results = state.results.filter((row) => row.date !== date(2));
  assertEmpty(state);
});

test('explicit zero actuals are scored, but percentage error is unavailable', () => {
  const state = fixture();
  state.sales.at(-1)!.portions = 0;
  state.results.at(-1)!.leftover = 0;
  const result = evaluateForecastHistory(state);
  assertCoverage(result, date(8), date(8), 1, 1);
  assert.deepEqual(result.sales, {
    rules: { mae: 97, wape: null, observations: 1 },
    priorWeek: { mae: 100, wape: null, observations: 1 },
  });
  assert.deepEqual(result.waste, {
    rules: { mae: 19, wape: null, observations: 1 },
    priorWeek: { mae: 20, wape: null, observations: 1 },
  });
});

test('a complete all-zero history is not mistaken for missing history', () => {
  const state = fixture(14);
  state.sales.forEach((row) => { row.portions = 0; });
  state.results.forEach((row) => { row.leftover = 0; });
  const result = evaluateForecastHistory(state);
  assertCoverage(result, date(8), date(14), 7, 7);
  for (const measure of [result.sales, result.waste]) {
    assert.deepEqual(measure.rules, { mae: 0, wape: null, observations: 7 });
    assert.deepEqual(measure.priorWeek, { mae: 0, wape: null, observations: 7 });
  }
});

test('WAPE uses total actuals including zero-actual observations, not an average percentage', () => {
  const state = fixture(8, ['a', 'b']);
  state.sales.find((row) => row.date === date(8) && row.menuId === 'a')!.portions = 0;
  state.results.find((row) => row.date === date(8) && row.menuId === 'a')!.leftover = 0;
  const result = evaluateForecastHistory(state);
  assertCoverage(result, date(8), date(8), 1, 2);
  assert.deepEqual(result.sales, {
    rules: { mae: 50, wape: 100, observations: 2 },
    priorWeek: { mae: 50, wape: 100, observations: 2 },
  });
  assert.deepEqual(result.waste, {
    rules: { mae: 10, wape: 100, observations: 2 },
    priorWeek: { mae: 10, wape: 100, observations: 2 },
  });
});

test('sales and waste percentage availability are calculated independently', () => {
  const state = fixture();
  state.results.at(-1)!.leftover = 0;
  const result = evaluateForecastHistory(state);
  assert.equal(result.sales.rules.wape, 3);
  assert.equal(result.sales.priorWeek.wape, 0);
  assert.equal(result.waste.rules.wape, null);
  assert.equal(result.waste.priorWeek.wape, null);
});

test('date bounds and sample counts describe only scored dish-days, including gaps', () => {
  const state = fixture(16, ['a', 'b']);
  // Candidate dates are Jan 10–16. No dish can score Jan 10–12 or Jan 14.
  state.sales = state.sales.filter((row) => row.date !== date(5) && row.date !== date(14));
  // A partial menu day on Jan 13 contributes one observation, not two.
  state.results = state.results.filter((row) => row.menuId !== 'a' || row.date !== date(13));
  const result = evaluateForecastHistory(state);
  assertCoverage(result, date(13), date(13), 1, 1);
});

test('a gap in scored dates is not counted as a held-out day', () => {
  const state = fixture(24);
  state.sales = state.sales.filter((row) => row.date !== date(16));
  // Latest seven candidate dates: Jan 18–24. Only Jan 24 is complete.
  assertCoverage(evaluateForecastHistory(state), date(24), date(24), 1, 1);
  // Add an earlier independently complete dish that scores Jan 18.
  const other = fixture(18, ['b']);
  state.menu.push(...other.menu);
  state.sales.push(...other.sales);
  state.results.push(...other.results);
  assertCoverage(evaluateForecastHistory(state), date(18), date(24), 2, 2);
});

test('only the latest seven candidate dates are tested, without backfilling older complete windows', () => {
  const state = fixture(24);
  assertCoverage(evaluateForecastHistory(state), date(18), date(24), 7, 7);
  state.sales = state.sales.filter((row) => row.date < date(18));
  assertEmpty(state);
});

test('archived and unknown dishes cannot supply scored dates or inflate counts', () => {
  const state = fixture(8, ['a', 'archived', 'unknown']);
  state.menu = state.menu.filter((item) => item.id !== 'unknown');
  state.menu.find((item) => item.id === 'archived')!.archivedAt = date(9);
  assert.deepEqual(evaluateForecastHistory(state), evaluateForecastHistory(fixture()));
});

test('multiple records on a dish-day are summed, not counted as extra observations', () => {
  const state = fixture(14);
  state.sales = state.sales.flatMap((row) => [
    { ...row, portions: 40 }, { ...row, portions: 60 },
  ]);
  state.results = state.results.flatMap((row) => [
    { ...row, leftover: 8 }, { ...row, leftover: 12 },
  ]);
  assert.deepEqual(evaluateForecastHistory(state), evaluateForecastHistory(fixture(14)));
});

test('input order and repeated evaluation do not change scores or mutate history', () => {
  const state = fixture(14, ['a', 'b']);
  const expected = evaluateForecastHistory(state);
  state.sales.reverse();
  state.results.reverse();
  state.menu.reverse();
  const before = structuredClone(state);
  assert.deepEqual(evaluateForecastHistory(state), expected);
  assert.deepEqual(evaluateForecastHistory(state), expected);
  assert.deepEqual(state, before);
});

test('empty, too-short, missing-series, and inactive-only histories return no scored period', () => {
  assertEmpty(fixture(0));
  assertEmpty(fixture(7));
  assertEmpty({ ...fixture(), sales: [] });
  assertEmpty({ ...fixture(), results: [] });
  assertEmpty({ ...fixture(), menu: [] });
  const archived = fixture();
  archived.menu[0]!.archivedAt = date(9);
  assertEmpty(archived);
});
