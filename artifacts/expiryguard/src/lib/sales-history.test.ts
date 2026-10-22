import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSalesHistoryGroups } from './sales-history.ts';

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
