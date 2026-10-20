import { Router, type IRouter } from "express";
import { db, guardWorkspace } from "@workspace/db";
import { eq } from "drizzle-orm";
import { AddGuardRecordsBody, DecideRecommendationBody, DecideRecommendationParams, GetGuardStateResponse } from "@workspace/api-zod";
import { compute, seed, today, round, type Stored } from "../lib/guard-model";

const router: IRouter = Router();
class InputError extends Error {}
const requiredString = (v: unknown, field: string): string => {
  if (typeof v !== "string" || !v.trim() || v.length > 160) throw new InputError(`${field} must be a non-empty string (max 160 characters).`);
  return v.trim();
};
const numeric = (v: unknown, field: string, integer = false): number => {
  if (v === "" || v == null || !Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 1000000 || (integer && !Number.isInteger(Number(v)))) throw new InputError(`${field} must be a non-negative ${integer ? "whole " : ""}number (max 1,000,000).`);
  return Number(v);
};
const date = (v: unknown, field: string) => {
  const value = requiredString(v, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new InputError(`${field} must be a valid YYYY-MM-DD date.`);
  return value;
};
async function initialize() {
  await db.insert(guardWorkspace).values({ id: "demo", data: seed() }).onConflictDoNothing();
}
async function change(action: (s: Stored) => void) {
  await initialize();
  return db.transaction(async tx => {
    const [record] = await tx.select().from(guardWorkspace).where(eq(guardWorkspace.id, "demo")).for("update");
    if (!record) throw new Error("Workspace unavailable.");
    const stored = record.data as Stored;
    action(stored);
    await tx.update(guardWorkspace).set({ data: stored }).where(eq(guardWorkspace.id, "demo"));
    return GetGuardStateResponse.parse(compute(stored));
  });
}
router.get("/guard/state", async (_req, res): Promise<void> => {
  await initialize();
  const [record] = await db.select().from(guardWorkspace).where(eq(guardWorkspace.id, "demo"));
  res.json(GetGuardStateResponse.parse(compute(record!.data as Stored)));
});
router.post("/guard/records", async (req, res): Promise<void> => {
  const parsed = AddGuardRecordsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const state = await change(s => {
      const { kind, rows } = parsed.data;
      rows.forEach((row, index) => {
        try {
          if (kind === "inventory") {
            const name = requiredString(row.name, "name");
            const existing = s.ingredients.find(i => i.id === row.id || i.name.toLowerCase() === name.toLowerCase());
            const ingredient = {
              id: existing?.id ?? (typeof row.id === "string" && row.id.trim() ? row.id.trim() : crypto.randomUUID()),
              name,
              quantity: numeric(row.quantity, "quantity"),
              unit: requiredString(row.unit, "unit"),
              expiry: date(row.expiry, "expiry"),
              cost: numeric(row.cost, "cost"),
              category: row.category ? requiredString(row.category, "category") : existing?.category ?? "Other",
              deliveryQuantity: numeric(row.deliveryQuantity ?? existing?.deliveryQuantity ?? 0, "deliveryQuantity"),
              deliveryDate: date(row.deliveryDate || existing?.deliveryDate || today(), "deliveryDate"),
            };
            if (!["kg", "L", "pcs"].includes(ingredient.unit)) throw new InputError("unit must be kg, L, or pcs.");
            if (existing && ingredient.unit !== existing.unit && s.menu.some(m => m.recipe.some(r => r.ingredientId === existing.id))) throw new InputError("Cannot change a recipe ingredient's unit.");
            if (existing) Object.assign(existing, ingredient); else s.ingredients.push(ingredient);
          } else {
            const menuId = requiredString(row.menuId, "menuId");
            if (!s.menu.some(m => m.id === menuId)) throw new InputError(`Unknown menuId '${menuId}'. Select an existing menu item.`);
            const recordDate = date(row.date, "date");
            if (recordDate > today()) throw new InputError("Actual sales and results cannot be dated in the future.");
            if (kind === "sales") {
              const value = { date: recordDate, menuId, portions: numeric(row.portions, "portions", true) };
              const existing = s.sales.find(r => r.date === recordDate && r.menuId === menuId);
              if (existing) Object.assign(existing, value); else s.sales.push(value);
            } else {
              const value = { date: recordDate, menuId, prepared: numeric(row.prepared, "prepared", true), sold: numeric(row.sold, "sold", true), leftover: numeric(row.leftover, "leftover", true) };
              if (value.prepared !== value.sold + value.leftover) throw new InputError("Prepared must equal sold + leftover.");
              const existing = s.results.find(r => r.date === recordDate && r.menuId === menuId);
              if (existing) Object.assign(existing, value); else s.results.push(value);
              const sale = s.sales.find(r => r.date === recordDate && r.menuId === menuId);
              if (sale) sale.portions = value.sold; else s.sales.push({ date: recordDate, menuId, portions: value.sold });
            }
          }
        } catch (e) { if (e instanceof InputError) throw new InputError(`Row ${index + 1}: ${e.message}`); throw e; }
      });
      s.activity.unshift({ id: crypto.randomUUID(), time: new Date().toISOString(), title: `${rows.length} ${kind} record${rows.length === 1 ? "" : "s"} saved`, detail: "Records added or updated. Forecasts recalculated; no orders were placed. Existing approvals remain recorded; stock is rechecked on approval.", decision: "input", impact: 0 });
    });
    res.json(state);
  } catch (err) {
    if (err instanceof InputError) { res.status(400).json({ error: err.message }); return; }
    throw err;
  }
});
router.post("/guard/recommendations/:id/decision", async (req, res): Promise<void> => {
  const body = DecideRecommendationBody.safeParse(req.body);
  const params = DecideRecommendationParams.safeParse(req.params);
  if (!body.success || !params.success) { res.status(400).json({ error: "Invalid decision or recommendation ID." }); return; }
  try {
    const state = await change(s => {
      const computed = compute(s);
      const recommendation = computed.recommendations.find(r => r.id === params.data.id);
      if (!recommendation) throw new InputError("This recommendation is no longer current. Refresh the page.");
      const { decision, quantity: input, note } = body.data;
      if (decision === "edited" && input == null) throw new InputError("Enter an adjusted quantity.");
      const quantity = decision === "rejected" ? null : numeric(input ?? recommendation.suggested, "quantity", recommendation.type === "preparation");
      if (quantity !== null && recommendation.type === "preparation") {
        const menu = s.menu.find(m => m.id === recommendation.targetId)!;
        for (const recipe of menu.recipe) {
          const stock = s.ingredients.find(i => i.id === recipe.ingredientId);
          const usable = stock && stock.expiry >= computed.tomorrow ? stock.quantity : 0;
          const allocated = computed.recommendations.filter(r => r.type === "preparation" && r.id !== recommendation.id && r.approvedQuantity !== null).reduce((n, r) => n + r.approvedQuantity! * (s.menu.find(m => m.id === r.targetId)?.recipe.find(v => v.ingredientId === recipe.ingredientId)?.amount ?? 0), 0);
          if (recipe.amount * quantity + allocated > usable + 0.000001) throw new InputError(`Not enough safe ${stock?.name ?? recipe.ingredientId} for tomorrow after other approved plans. Reduce portions or update stock. Expired stock is excluded.`);
        }
      }
      if (quantity !== null && recommendation.type === "use-first") {
        const stock = s.ingredients.find(i => i.id === recommendation.targetId)!;
        if (stock.expiry < computed.tomorrow || quantity > stock.quantity) throw new InputError("Use-first quantity must be within safe stock available tomorrow.");
      }
      const ingredient = s.ingredients.find(i => i.id === recommendation.targetId);
      const savings = recommendation.type === "purchase" && quantity !== null ? round((recommendation.original - quantity) * (ingredient?.cost ?? 0)) : 0;
      s.decisions[recommendation.id] = { decision, quantity, original: recommendation.original, savings };
      if (recommendation.type === "purchase" && ingredient) ingredient.deliveryQuantity = quantity ?? recommendation.original;
      s.activity.unshift({ id: crypto.randomUUID(), time: new Date().toISOString(), title: recommendation.title, detail: `${recommendation.description} Owner ${decision}. ${recommendation.original} → ${quantity ?? recommendation.original} ${recommendation.unit}. ${recommendation.type === "purchase" && quantity !== null ? "Internal purchasing plan updated. No supplier order placed." : recommendation.type === "preparation" && quantity !== null ? `Preparation plan saved for ${computed.tomorrow}.` : "No purchasing change."}${note ? ` Note: ${note}` : ""}`, decision, impact: savings });
    });
    res.json(state);
  } catch (err) {
    if (err instanceof InputError) { res.status(400).json({ error: err.message }); return; }
    throw err;
  }
});
export default router;
