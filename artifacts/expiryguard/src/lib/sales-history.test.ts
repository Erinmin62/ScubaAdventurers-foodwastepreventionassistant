import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSalesHistoryGroups, buildSalesPeriodSummary } from './sales-history.ts';

type History = Parameters<typeof buildSalesHistoryGroups>[0];

function historyFixture(): History {
  return {
    menu: [
      { id: 'toast', name: 'Avocado Toast', description: '', price: 20, cost: 8, archivedAt: null, recipe: [] },
      { id: 'coffee', name: 'Flat White', description: '', price: 12, cost: 4, archivedAt: null, recipe: [] },
    ],
    sales: [
      { date: '2026-10-20', menuId: 'toast', menuName: 'Green Toast', menuPrice: 15, portions: 2 },
      { date: '2026-10-20', menuId: 'toast', menuName: 'Avocado Toast', menuPrice: 18, portions: 3 },
      { date: '2026-10-20', menuId: 'toast', menuName: 'Seasonal Toast', menuPrice: 25, portions: 1 },
      { date: '2026-10-20', menuId: 'coffee', portions: 4 },
    ],
  };
}

test('duplicate sale rows aggregate portions and each sale-specific price into item and daily totals', () => {
  const [group] = buildSalesHistoryGroups(historyFixture(), '', '');
  assert.ok(group);
  assert.equal(group.portions, 10);
  assert.equal(group.revenue, 2 * 15 + 3 * 18 + 1 * 25 + 4 * 12);
  assert.deepEqual(
    group.items.map(({ id, portions, revenue }) => ({ id, portions, revenue })),
    [
      { id: 'coffee', portions: 4, revenue: 48 },
      { id: 'toast', portions: 6, revenue: 109 },
    ],
  );
});

test('searching current or historical item names retains all rows for that item', () => {
  const history = historyFixture();

  for (const query of ['Avocado', 'Green']) {
    const [group] = buildSalesHistoryGroups(history, '', query);
    assert.ok(group, `expected a result for ${query}`);
    assert.equal(group.portions, 6);
    assert.equal(group.revenue, 109);
    assert.deepEqual(group.items.map((item) => item.id), ['toast']);
  }
});

test('defaults to the latest 14 dates with sales and exact-date filtering reaches older history', () => {
  const history = historyFixture();
  history.sales = Array.from({ length: 16 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 9, index + 1)).toISOString().slice(0, 10),
    menuId: 'toast',
    portions: index + 1,
    menuName: 'Avocado Toast',
    menuPrice: 10,
  }));

  const latest = buildSalesHistoryGroups(history, '', '');
  assert.equal(latest.length, 14);
  assert.equal(latest[0]?.date, '2026-10-16');
  assert.equal(latest.at(-1)?.date, '2026-10-03');

  const olderDate = buildSalesHistoryGroups(history, '2026-10-01', '');
  assert.equal(olderDate.length, 1);
  assert.equal(olderDate[0]?.date, '2026-10-01');
  assert.equal(olderDate[0]?.portions, 1);
  assert.equal(olderDate[0]?.revenue, 10);
  assert.deepEqual(buildSalesHistoryGroups(history, '2026-09-30', ''), []);
});

test('period summary includes both boundary dates and combines duplicate rows with their recorded prices', () => {
  const history = historyFixture();
  history.sales.push(
    { date: '2026-10-19', menuId: 'toast', portions: 100, menuPrice: 1 },
    { date: '2026-10-21', menuId: 'toast', menuName: 'Market Toast', portions: 2, menuPrice: 20 },
    { date: '2026-10-22', menuId: 'coffee', portions: 50, menuPrice: 1 },
  );

  const summary = buildSalesPeriodSummary(history, '2026-10-20', '2026-10-21');
  assert.equal(summary.portions, 12);
  assert.equal(summary.revenue, 197);
  assert.deepEqual(
    summary.items.map(({ id, name, portions, revenue }) => ({ id, name, portions, revenue })),
    [
      { id: 'coffee', name: 'Flat White', portions: 4, revenue: 48 },
      { id: 'toast', name: 'Green Toast', portions: 8, revenue: 149 },
    ],
  );
});

test('period summary uses older dated records rather than the recent-history display limit', () => {
  const history = historyFixture();
  history.sales = Array.from({ length: 20 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 8, index + 1)).toISOString().slice(0, 10),
    menuId: 'toast',
    portions: index + 1,
    menuName: 'Avocado Toast',
    menuPrice: 10,
  }));

  const summary = buildSalesPeriodSummary(history, '2026-09-01', '2026-09-20');
  assert.equal(summary.portions, 210);
  assert.equal(summary.revenue, 2_100);
  assert.equal(summary.items.length, 1);
  assert.equal(summary.items[0]?.portions, 210);
});
