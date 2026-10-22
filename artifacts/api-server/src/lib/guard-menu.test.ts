import { test } from "node:test";
import assert from "node:assert/strict";
import { createMenuItem, deleteMenuItem, importMenuCsv, previewMenuCsv, updateMenuItem } from "./guard-menu";
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

const menuCsv = `dish_name,description,price,cost,ingredient_name,ingredient_unit,quantity_per_portion
"Tomato, basil toast","With ""fresh"" tomatoes",18,5,"Cherry tomatoes",kg,0.1
"Tomato, basil toast","With ""fresh"" tomatoes",18,5,"Sourdough bread",kg,0.08`;

test("menu CSV preview parses quoted fields and validates pantry name and units", () => {
  const s = seed();
  const preview = previewMenuCsv(s, menuCsv);
  assert.equal(preview.valid, true);
  assert.equal(preview.dishCount, 1);
  assert.deepEqual(preview.dishes, [{
    name: "Tomato, basil toast",
    description: 'With "fresh" tomatoes',
    action: "add",
    price: 18,
    cost: 5,
    ingredientCount: 2,
    ingredients: [
      { name: "Cherry tomatoes", unit: "kg", quantityPerPortion: 0.1 },
      { name: "Sourdough bread", unit: "kg", quantityPerPortion: 0.08 },
    ],
  }]);
  assert.equal(preview.parsedDishes[0]?.description, 'With "fresh" tomatoes');

  const wrongUnit = previewMenuCsv(s, menuCsv.replace(",kg,0.1", ",L,0.1"));
  assert.equal(wrongUnit.valid, false);
  assert.ok(wrongUnit.errors.some(error => error.includes("must use a pantry unit")));
  const wrongIngredient = previewMenuCsv(s, menuCsv.replace("Cherry tomatoes", "Another owner's tomatoes"));
  assert.equal(wrongIngredient.valid, false);
  assert.ok(wrongIngredient.errors.some(error => error.includes("is not in this owner's pantry")));
});

test("invalid menu CSV is rejected without partial menu or history changes", () => {
  const s = seed();
  const before = structuredClone(s);
  const invalidAfterOneValidRow = `${menuCsv}\n"Second dish","Valid first ingredient",20,6,"Missing pantry item",kg,0.2`;
  assert.throws(() => importMenuCsv(s, invalidAfterOneValidRow), InputError);
  assert.deepEqual(s, before);
});

test("menu CSV import adds all recipes and leaves existing historical snapshots intact", () => {
  const s = seed();
  const previousMenu = structuredClone(s.menu);
  const previousSales = structuredClone(s.sales);
  const previousResults = structuredClone(s.results);
  const previousRevision = s.menuRevision;
  assert.equal(importMenuCsv(s, menuCsv), 1);
  const added = s.menu.find(item => item.name === "Tomato, basil toast")!;
  assert.equal(added.archivedAt, null);
  assert.equal(added.recipe.length, 2);
  assert.deepEqual(s.menu.filter(item => previousMenu.some(old => old.id === item.id)), previousMenu);
  assert.deepEqual(s.sales, previousSales);
  assert.deepEqual(s.results, previousResults);
  assert.equal(s.menuRevision, (previousRevision ?? 0) + 1);
});

test("menu CSV preview classifies matching dishes and confirmed updates preserve historical menu snapshots", () => {
  const s = seed();
  const dish = s.menu.find(item => item.id === "avo-toast")!;
  const salesBefore = s.sales.filter(row => row.menuId === dish.id).map(row => structuredClone(row));
  const resultsBefore = s.results.filter(row => row.menuId === dish.id).map(row => structuredClone(row));
  const updateCsv = `dish_name,description,price,cost,ingredient_name,ingredient_unit,quantity_per_portion
"Avocado Toast","New menu description",28,10,"Avocados",kg,0.2`;
  const preview = previewMenuCsv(s, updateCsv);
  assert.equal(preview.valid, true);
  assert.equal(preview.dishes[0]?.action, "update");
  assert.equal(preview.dishes[0]?.description, "New menu description");
  assert.equal(previewMenuCsv(s, menuCsv).dishes[0]?.action, "add");

  const previousName = dish.name;
  const previousPrice = dish.price;
  const previousCost = dish.cost;
  const previousRecipe = structuredClone(dish.recipe);
  assert.equal(importMenuCsv(s, updateCsv, preview.menuRevision), 1);
  assert.equal(dish.description, "New menu description");
  assert.equal(dish.price, 28);
  assert.equal(dish.cost, 10);
  assert.deepEqual(dish.recipe, [{ ingredientId: "avocado", amount: 0.2 }]);
  assert.deepEqual(s.sales.filter(row => row.menuId === dish.id), salesBefore.map(row => ({
    ...row,
    menuName: row.menuName ?? previousName,
    menuPrice: row.menuPrice ?? previousPrice,
    menuCost: row.menuCost ?? previousCost,
    menuRecipe: row.menuRecipe ?? previousRecipe,
  })));
  assert.deepEqual(s.results.filter(row => row.menuId === dish.id), resultsBefore.map(row => ({
    ...row,
    menuName: row.menuName ?? previousName,
    menuPrice: row.menuPrice ?? previousPrice,
    menuCost: row.menuCost ?? previousCost,
    menuRecipe: row.menuRecipe ?? previousRecipe,
  })));
});

test("menu CSV import rejects an ambiguous active-name match without partial changes", () => {
  const s = seed();
  s.menu.push({ ...structuredClone(s.menu.find(item => item.id === "avo-toast")!), id: "duplicate-active" });
  const before = structuredClone(s);
  const updateCsv = `dish_name,description,price,cost,ingredient_name,ingredient_unit,quantity_per_portion
"Avocado Toast","New menu description",28,10,"Avocados",kg,0.2`;
  assert.equal(previewMenuCsv(s, updateCsv).valid, false);
  assert.throws(() => importMenuCsv(s, updateCsv), InputError);
  assert.deepEqual(s, before);
});

test("menu CSV import rejects a stale preview before changing menu data", () => {
  const s = seed();
  const csv = `dish_name,description,price,cost,ingredient_name,ingredient_unit,quantity_per_portion
"Tomato, basil toast","With basil",18,5,"Cherry tomatoes",kg,0.1`;
  const expectedRevision = previewMenuCsv(s, csv).menuRevision;
  createMenuItem(s, input);
  const beforeStaleImport = structuredClone(s);
  assert.throws(() => importMenuCsv(s, csv, expectedRevision), InputError);
  assert.deepEqual(s, beforeStaleImport);
});
