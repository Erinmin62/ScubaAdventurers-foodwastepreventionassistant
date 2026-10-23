import assert from "node:assert/strict";
import { test } from "node:test";
import { compute, seed } from "./guard-model";

function forecastFor(sales: ReturnType<typeof seed>["sales"], menuId: string) {
  const state = seed();
  state.sales = sales;
  return compute(state).forecasts.find(row => row.menuId === menuId)!;
}

test("live forecasts preserve daily totals and confidence when one day's sales are split across entries", () => {
  const state = seed();
  const menuId = state.menu[0]!.id;
  const baseline = forecastFor(state.sales, menuId);
  const row = state.sales.filter(item => item.menuId === menuId).at(-1)!;
  const firstPart = Math.floor(row.portions / 3);
  state.sales.splice(state.sales.indexOf(row), 1,
    { ...row, portions: firstPart },
    { ...row, portions: row.portions - firstPart },
  );

  const split = forecastFor(state.sales, menuId);
  assert.equal(split.predicted, baseline.predicted);
  assert.equal(split.confidence, baseline.confidence);
  assert.match(split.reason, /^7-day mean/);
});

test("duplicate sales rows cannot inflate forecast confidence beyond distinct recorded days", () => {
  const state = seed();
  const menuId = state.menu[0]!.id;
  const lastSevenDates = [...new Set(state.sales.filter(row => row.menuId === menuId).map(row => row.date))].slice(-7);
  const fourDays = lastSevenDates.slice(0, 4).map(day => state.sales.find(row => row.menuId === menuId && row.date === day)!);
  state.sales = [
    ...state.sales.filter(row => row.menuId !== menuId || !lastSevenDates.includes(row.date)),
    ...fourDays.flatMap(row => Array.from({ length: 3 }, () => ({ ...row }))),
  ];

  const forecast = forecastFor(state.sales, menuId);
  assert.equal(forecast.confidence, "Limited data");
  assert.match(forecast.reason, /^4-day mean/);
});
