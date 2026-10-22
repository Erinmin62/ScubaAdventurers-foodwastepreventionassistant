import { test } from "node:test";
import assert from "node:assert/strict";
import { createMenuItem, deleteMenuItem, updateMenuItem } from "./guard-menu";
import { compute, seed, today, type State } from "./guard-model";
import { InputError } from "./guard-follow-ups";

const input = {
  name: "Tomato toast",
  description: "Toast with tomato.",
  price: 18,
  cost: 5,
  recipe: [{ ingredientId: "tomato", amount: 0.1 }],
};

test("menu CRUD validates owner ingredients and advances the planning revision", () => {
  const s = seed();
  const revision = s.menuRevision;
  assert.throws(() => createMenuItem(s, { ...input, recipe: [{ ingredientId: "not-in-pantry", amount: 1 }] }), InputError);
  assert.equal(s.menuRevision, revision);
  createMenuItem(s, input);
  const item = s.menu.find(m => m.name === input.name)!;
  assert.ok(item.id);
  assert.equal(item.archivedAt, null);
  assert.equal(s.menuRevision, (revision ?? 0) + 1);
  assert.ok(compute(s).forecasts.some(f => f.menuId === item.id));

  assert.throws(() => createMenuItem(s, { ...input, name: "tomato toast" }), InputError);
  assert.throws(() => updateMenuItem(s, item.id, { name: "Avocado Toast" }), InputError);
});

test("menu edits snapshot old history and require fresh approval for changed planning", () => {
  const s = seed();
  const oldRecommendation = compute(s).recommendations.find(r => r.type === "preparation" && r.targetId === "avo-toast")!;
  s.decisions[oldRecommendation.id] = {
    decision: "approved", quantity: oldRecommendation.suggested, original: oldRecommendation.original,
    savings: 0, recommendation: oldRecommendation,
  };
  const beforeWaste = compute(s).summary.actualWasteCost;
  updateMenuItem(s, "avo-toast", { name: "Avocado Toast Deluxe", price: 30, cost: 12 });
  const after = compute(s);
  const currentRecommendation = after.recommendations.find(r => r.type === "preparation" && r.targetId === "avo-toast")!;
  assert.notEqual(currentRecommendation.id, oldRecommendation.id);
  assert.equal(currentRecommendation.status, "pending");
  assert.equal(after.approvedRecommendations.some(r => r.id === oldRecommendation.id), true);
  assert.equal(after.summary.actualWasteCost, beforeWaste, "old actual waste keeps the recorded per-portion cost");
  assert.ok(s.sales.filter(r => r.menuId === "avo-toast").every(r => r.menuName === "Avocado Toast" && r.menuPrice === 22));
  assert.ok(s.results.filter(r => r.menuId === "avo-toast").every(r => r.menuCost === 7.5 && r.menuRecipe?.length));
});

test("archiving preserves history but removes a dish from current forecasts and deletes unused dishes", () => {
  const s = seed();
  const old = s.menu.find(m => m.id === "avo-toast")!;
  deleteMenuItem(s, old.id);
  const archived = s.menu.find(m => m.id === old.id)!;
  assert.ok(archived.archivedAt);
  assert.ok(s.sales.filter(r => r.menuId === old.id).every(r => r.menuName === old.name));
  assert.equal(compute(s).forecasts.some(f => f.menuId === old.id), false);

  createMenuItem(s, input);
  const unused = s.menu.find(m => m.name === input.name)!;
  deleteMenuItem(s, unused.id);
  assert.equal(s.menu.some(m => m.id === unused.id), false);
  assert.equal(typeof today(), "string");
});
