import { CreateMenuItemBody, UpdateMenuItemBody } from "@workspace/api-zod";
import { InputError } from "./guard-follow-ups";
import type { State, Stored } from "./guard-model";

export type CreateMenuInput = typeof CreateMenuItemBody._output;
export type UpdateMenuInput = typeof UpdateMenuItemBody._output;
type MenuItem = State["menu"][number];
type Recipe = MenuItem["recipe"];

function validateName(name: string, s: Stored, excludeId?: string, active = true) {
  const value = name.trim();
  if (!value || value.length > 120) throw new InputError("Dish name must be 1–120 characters.");
  if (active && s.menu.some(m => m.id !== excludeId && !m.archivedAt && m.name.trim().toLocaleLowerCase() === value.toLocaleLowerCase())) {
    throw new InputError("An active dish already uses that name.");
  }
  return value;
}

function validateRecipe(s: Stored, recipe: Recipe) {
  if (!recipe.length) throw new InputError("Add at least one ingredient to the recipe.");
  if (recipe.length > 50) throw new InputError("A recipe can contain at most 50 ingredients.");
  const seen = new Set<string>();
  for (const row of recipe) {
    if (!s.ingredients.some(i => i.id === row.ingredientId)) throw new InputError(`Recipe ingredient '${row.ingredientId}' is not in this workspace's pantry.`);
    if (!Number.isFinite(row.amount) || row.amount <= 0 || row.amount > 1_000_000) throw new InputError("Recipe amounts must be positive numbers.");
    if (seen.has(row.ingredientId)) throw new InputError("Each pantry ingredient can appear only once in a recipe.");
    seen.add(row.ingredientId);
  }
}

export function snapshotMenuHistory(s: Stored, item: MenuItem) {
  const snapshot = {
    menuName: item.name,
    menuPrice: item.price,
    menuCost: item.cost,
    menuRecipe: structuredClone(item.recipe),
  };
  for (const sale of s.sales) {
    if (sale.menuId !== item.id) continue;
    sale.menuName ??= snapshot.menuName;
    sale.menuPrice ??= snapshot.menuPrice;
    sale.menuCost ??= snapshot.menuCost;
    sale.menuRecipe ??= structuredClone(snapshot.menuRecipe);
  }
  for (const result of s.results) {
    if (result.menuId !== item.id) continue;
    result.menuName ??= snapshot.menuName;
    result.menuPrice ??= snapshot.menuPrice;
    result.menuCost ??= snapshot.menuCost;
    result.menuRecipe ??= structuredClone(snapshot.menuRecipe);
  }
}

function changed(s: Stored, title: string, detail: string) {
  s.menuRevision = (s.menuRevision ?? 0) + 1;
  s.automationProgress ??= {};
  s.automationProgress.dailyDate = undefined;
  s.activity.unshift({
    id: crypto.randomUUID(),
    time: new Date().toISOString(),
    title,
    detail,
    decision: "input",
    impact: 0,
  });
}

export function createMenuItem(s: Stored, raw: unknown) {
  const parsed = CreateMenuItemBody.safeParse(raw);
  if (!parsed.success) throw new InputError("Provide a dish name, description, non-negative price and cost, and recipe.");
  const input = parsed.data;
  const name = validateName(input.name, s);
  const description = input.description.trim();
  if (description.length > 500) throw new InputError("Description must be at most 500 characters.");
  if (![input.price, input.cost].every(v => Number.isFinite(v) && v >= 0 && v <= 1_000_000)) throw new InputError("Price and cost must be non-negative numbers.");
  validateRecipe(s, input.recipe);
  const item: MenuItem = {
    id: crypto.randomUUID(),
    name,
    description,
    price: input.price,
    cost: input.cost,
    recipe: structuredClone(input.recipe),
    archivedAt: null,
  };
  s.menu.push(item);
  changed(s, `Menu dish added: ${item.name}`, "New dish is available for future sales entries, forecasts and preparation plans. No order was placed.");
}

export function updateMenuItem(s: Stored, id: string, raw: unknown) {
  const parsed = UpdateMenuItemBody.safeParse(raw);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) throw new InputError("Provide valid dish details or an active status.");
  const item = s.menu.find(m => m.id === id);
  if (!item) throw new InputError("Dish not found.");
  const input = parsed.data;
  const willBeActive = input.active ?? !item.archivedAt;
  const name = input.name === undefined ? item.name : validateName(input.name, s, id, willBeActive);
  if (input.name === undefined && willBeActive) validateName(item.name, s, id, true);
  const description = input.description === undefined ? item.description ?? "" : input.description.trim();
  if (description.length > 500) throw new InputError("Description must be at most 500 characters.");
  const recipe = input.recipe ?? item.recipe;
  if (input.recipe !== undefined) validateRecipe(s, recipe);
  const price = input.price ?? item.price;
  const cost = input.cost ?? item.cost;
  if (![price, cost].every(v => Number.isFinite(v) && v >= 0 && v <= 1_000_000)) throw new InputError("Price and cost must be non-negative numbers.");

  const contentChanged = input.name !== undefined || input.description !== undefined || input.price !== undefined || input.cost !== undefined || input.recipe !== undefined;
  const statusChanged = input.active !== undefined && input.active !== !item.archivedAt;
  if (contentChanged || statusChanged) snapshotMenuHistory(s, item);
  item.name = name;
  item.description = description;
  item.price = price;
  item.cost = cost;
  item.recipe = structuredClone(recipe);
  item.archivedAt = willBeActive ? null : item.archivedAt ?? new Date().toISOString();
  if (contentChanged || statusChanged) {
    changed(s, `Menu dish updated: ${item.name}`, `${willBeActive ? "Active menu updated" : "Dish archived"}; prior records keep their original menu details. New forecasts and preparation plans use the current active menu.`);
  }
}

export function deleteMenuItem(s: Stored, id: string) {
  const index = s.menu.findIndex(m => m.id === id);
  if (index < 0) throw new InputError("Dish not found.");
  const item = s.menu[index]!;
  const hasDecisionHistory = Object.entries(s.decisions).some(([decisionId, decision]) =>
    decision.recommendation?.targetId === id || decisionId.split(":")[2] === id,
  );
  const hasFollowUpHistory = (s.followUps ?? []).some(f => f.recommendation.targetId === id);
  const hasHistory = s.sales.some(r => r.menuId === id) || s.results.some(r => r.menuId === id) || hasDecisionHistory || hasFollowUpHistory;
  if (hasHistory) {
    snapshotMenuHistory(s, item);
    item.archivedAt ??= new Date().toISOString();
    changed(s, `Menu dish archived: ${item.name}`, "History exists, so the dish was archived rather than erased. It is excluded from new entries and future planning.");
  } else {
    s.menu.splice(index, 1);
    changed(s, `Unused menu dish removed: ${item.name}`, "The dish had no sales, results, decisions or follow-ups. It was removed from the active catalog.");
  }
}
