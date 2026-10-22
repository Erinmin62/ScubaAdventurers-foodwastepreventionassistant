import { CreateMenuItemBody, UpdateMenuItemBody } from "@workspace/api-zod";
import { InputError } from "./guard-follow-ups";
import type { State, Stored } from "./guard-model";

export type CreateMenuInput = typeof CreateMenuItemBody._output;
export type UpdateMenuInput = typeof UpdateMenuItemBody._output;
type MenuItem = State["menu"][number];
type Recipe = MenuItem["recipe"];
const CSV_HEADERS = ["dish_name", "description", "price", "cost", "ingredient_name", "ingredient_unit", "quantity_per_portion"];

export type MenuCsvPreview = {
  valid: boolean;
  dishCount: number;
  dishes: {
    name: string;
    price: number;
    cost: number;
    ingredientCount: number;
    ingredients: { name: string; unit: string; quantityPerPortion: number }[];
  }[];
  errors: string[];
};

type ParsedCsv = { rows: string[][]; errors: string[] };

function parseCsv(content: string): ParsedCsv {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;
  const errors: string[] = [];
  const text = content.replace(/^\uFEFF/, "");

  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { field += '"'; index++; }
        else { quoted = false; closedQuote = true; }
      } else field += char;
      continue;
    }
    if (closedQuote && char !== "," && char !== "\r" && char !== "\n") {
      errors.push("CSV contains characters after a closing quote.");
      return { rows, errors };
    }
    if (char === '"') {
      if (field.length > 0 || closedQuote) {
        errors.push("CSV contains a quote inside an unquoted field.");
        return { rows, errors };
      }
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
      closedQuote = false;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(field);
      if (row.some(value => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
      closedQuote = false;
      if (rows.length > 5001) {
        errors.push("CSV can contain at most 5,000 ingredient rows.");
        return { rows, errors };
      }
    } else {
      field += char;
    }
  }
  if (quoted) {
    errors.push("CSV has an unclosed quoted field.");
    return { rows, errors };
  }
  row.push(field);
  if (row.some(value => value.trim() !== "")) rows.push(row);
  if (rows.length > 5001) errors.push("CSV can contain at most 5,000 ingredient rows.");
  return { rows, errors };
}

type MenuCsvDish = {
  name: string;
  description: string;
  price: number;
  cost: number;
  recipe: Recipe;
};

export function previewMenuCsv(s: Stored, csv: string): MenuCsvPreview & { parsedDishes: MenuCsvDish[] } {
  const errors: string[] = [];
  if (typeof csv !== "string" || csv.length === 0) {
    return { valid: false, dishCount: 0, dishes: [], errors: ["Choose a CSV file to preview."], parsedDishes: [] };
  }
  if (csv.length > 2_000_000) {
    return { valid: false, dishCount: 0, dishes: [], errors: ["CSV must be 2 MB or smaller."], parsedDishes: [] };
  }
  const parsedCsv = parseCsv(csv);
  errors.push(...parsedCsv.errors);
  const [header, ...dataRows] = parsedCsv.rows;
  if (!header) errors.push("CSV is empty. Include the required column headings.");

  const normalizedHeaders = (header ?? []).map(value => value.trim().toLowerCase());
  const headerIndex = new Map(normalizedHeaders.map((value, index) => [value, index]));
  const missingHeaders = CSV_HEADERS.filter(value => !headerIndex.has(value));
  const unexpectedHeaders = normalizedHeaders.filter(value => !CSV_HEADERS.includes(value));
  if (header && (missingHeaders.length || unexpectedHeaders.length || normalizedHeaders.length !== CSV_HEADERS.length)) {
    const problems = [
      missingHeaders.length ? `missing ${missingHeaders.join(", ")}` : "",
      unexpectedHeaders.length ? `unexpected ${unexpectedHeaders.join(", ")}` : "",
      normalizedHeaders.length !== CSV_HEADERS.length ? "duplicate or extra columns" : "",
    ].filter(Boolean);
    errors.push(`CSV headings are invalid (${problems.join("; ")}).`);
  }
  if (dataRows.length === 0 && header) errors.push("CSV has no ingredient rows.");
  if (dataRows.length > 5000) errors.push("CSV can contain at most 5,000 ingredient rows.");

  const groups = new Map<string, MenuCsvDish>();
  const seenIngredients = new Map<string, Set<string>>();
  const pantryByName = new Map<string, typeof s.ingredients>();
  for (const item of s.ingredients) {
    const key = item.name.trim().toLocaleLowerCase();
    pantryByName.set(key, [...(pantryByName.get(key) ?? []), item]);
  }
  const get = (cells: string[], key: string) => cells[headerIndex.get(key) ?? -1]?.trim() ?? "";
  for (const [index, cells] of dataRows.entries()) {
    const line = index + 2;
    if (cells.length !== normalizedHeaders.length) {
      errors.push(`Row ${line}: expected ${normalizedHeaders.length} columns but found ${cells.length}.`);
      continue;
    }
    const name = get(cells, "dish_name");
    const description = get(cells, "description");
    const rawPrice = get(cells, "price");
    const rawCost = get(cells, "cost");
    const ingredientName = get(cells, "ingredient_name");
    const ingredientUnit = get(cells, "ingredient_unit");
    const rawAmount = get(cells, "quantity_per_portion");
    const price = Number(rawPrice);
    const cost = Number(rawCost);
    const amount = Number(rawAmount);
    let rowValid = true;

    if (!name || name.length > 120) { errors.push(`Row ${line}: dish name must be 1–120 characters.`); rowValid = false; }
    if (description.length > 500) { errors.push(`Row ${line}: description must be at most 500 characters.`); rowValid = false; }
    if (!rawPrice || !Number.isFinite(price) || price < 0 || price > 1_000_000) { errors.push(`Row ${line}: price must be a number from 0 to 1,000,000.`); rowValid = false; }
    if (!rawCost || !Number.isFinite(cost) || cost < 0 || cost > 1_000_000) { errors.push(`Row ${line}: cost must be a number from 0 to 1,000,000.`); rowValid = false; }
    if (!rawAmount || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) { errors.push(`Row ${line}: quantity per portion must be above 0 and at most 1,000,000.`); rowValid = false; }

    const pantryOptions = pantryByName.get(ingredientName.toLocaleLowerCase());
    const pantryItem = pantryOptions?.find(item => item.unit.trim().toLocaleLowerCase() === ingredientUnit.toLocaleLowerCase());
    if (!ingredientName || !pantryOptions?.length) {
      errors.push(`Row ${line}: ingredient '${ingredientName || "(blank)"}' is not in this owner's pantry.`);
      rowValid = false;
    } else if (!pantryItem) {
      const expectedUnits = [...new Set(pantryOptions.map(item => item.unit))].join(", ");
      errors.push(`Row ${line}: '${ingredientName}' must use a pantry unit (${expectedUnits}), not '${ingredientUnit || "(blank)"}'.`);
      rowValid = false;
    }

    if (!name) continue;
    const key = name.toLocaleLowerCase();
    const dish = groups.get(key);
    if (dish && (dish.name !== name || dish.description !== description || dish.price !== price || dish.cost !== cost)) {
      errors.push(`Row ${line}: repeated dish details for '${name}' must match its first row.`);
      rowValid = false;
    }
    if (!dish && s.menu.some(item => !item.archivedAt && item.name.trim().toLocaleLowerCase() === key)) {
      errors.push(`Row ${line}: an active dish already uses the name '${name}'.`);
      rowValid = false;
    }
    const ingredientId = pantryItem?.id;
    if (dish && ingredientId && (seenIngredients.get(key)?.has(ingredientId) ?? false)) {
      errors.push(`Row ${line}: '${ingredientName}' appears more than once in '${name}'.`);
      rowValid = false;
    }
    if (!dish && rowValid) {
      groups.set(key, { name, description, price, cost, recipe: [] });
      seenIngredients.set(key, new Set());
    }
    const group = groups.get(key);
    if (group && rowValid && ingredientId) {
      group.recipe.push({ ingredientId, amount });
      seenIngredients.get(key)!.add(ingredientId);
    }
  }

  if (groups.size > 250) errors.push("CSV can contain at most 250 dishes.");
  for (const dish of groups.values()) {
    if (!dish.recipe.length) errors.push(`Dish '${dish.name}' has no valid recipe ingredients.`);
    if (dish.recipe.length > 50) errors.push(`Dish '${dish.name}' can have at most 50 recipe ingredients.`);
  }
  const parsedDishes = [...groups.values()];
  return {
    valid: errors.length === 0 && parsedDishes.length > 0,
    dishCount: parsedDishes.length,
    dishes: parsedDishes.map(({ name, price, cost, recipe }) => ({
      name,
      price,
      cost,
      ingredientCount: recipe.length,
      ingredients: recipe.map(row => {
        const ingredient = s.ingredients.find(item => item.id === row.ingredientId)!;
        return { name: ingredient.name, unit: ingredient.unit, quantityPerPortion: row.amount };
      }),
    })),
    errors,
    parsedDishes,
  };
}

export function importMenuCsv(s: Stored, csv: string) {
  const preview = previewMenuCsv(s, csv);
  if (!preview.valid) throw new InputError(preview.errors.join(" "));
  for (const input of preview.parsedDishes) {
    const name = validateName(input.name, s);
    validateRecipe(s, input.recipe);
  }
  const items: MenuItem[] = preview.parsedDishes.map(input => ({
    id: crypto.randomUUID(),
    name: input.name.trim(),
    description: input.description.trim(),
    price: input.price,
    cost: input.cost,
    recipe: structuredClone(input.recipe),
    archivedAt: null,
  }));
  s.menu.push(...items);
  changed(s, `Menu imported: ${items.length} dishes`, "New dishes and per-portion recipes were added from an owner-validated CSV. Existing menu history was not changed.");
  return items.length;
}

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
