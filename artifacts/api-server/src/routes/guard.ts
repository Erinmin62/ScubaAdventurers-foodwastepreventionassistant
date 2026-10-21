import { Router, type IRouter } from "express";
import { AddGuardRecordsBody, DecideRecommendationBody, DecideRecommendationParams, AttachFollowUpBody, RecordFollowUpOutcomeBody, UpdateAutomationBody, RunAutomationBody } from "@workspace/api-zod";
import { compute, today, round } from "../lib/guard-model";
import { changeWorkspace as change } from "../lib/guard-store";
import { runWorkflows } from "../lib/guard-automation";
import { InputError, cancelOutstanding, completeFollowUp, scheduleFollowUp } from "../lib/guard-follow-ups";

const router: IRouter = Router();
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
router.get("/guard/state", async (_req, res): Promise<void> => {
  res.json(await change());
});
router.patch("/guard/automation", async (req, res): Promise<void> => {
  const body = UpdateAutomationBody.safeParse(req.body);
  if (!body.success || Object.keys(body.data).length === 0) { res.status(400).json({ error: "Provide a workflow toggle as true or false." }); return; }
  res.json(await change(s => {
    s.automation ??= { dailyPlanning: true, followUpHandling: true, runs: [] };
    const updates: string[] = [];
    for (const key of ["dailyPlanning", "followUpHandling"] as const) {
      const value = body.data[key];
      if (value !== undefined && value !== s.automation[key]) {
        s.automation[key] = value;
        updates.push(`${key === "dailyPlanning" ? "Daily planning" : "Follow-up handling"} ${value ? "enabled" : "paused"}`);
      }
    }
    if (updates.length) s.activity.unshift({ id: crypto.randomUUID(), time: new Date().toISOString(), title: "Automation settings changed", detail: `${updates.join(". ")}. Existing follow-ups and live expiry safety checks remain available. No orders placed.`, decision: "automation", impact: 0 });
  }));
});
router.post("/guard/automation/run", async (req, res): Promise<void> => {
  const body = RunAutomationBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Select daily-planning, follow-ups, or all." }); return; }
  try { res.json(await change(s => runWorkflows(s, body.data.workflow), false)); }
  catch (err) { if (err instanceof InputError) { res.status(400).json({ error: err.message }); return; } throw err; }
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
              measuredDate: today(),
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
      if (s.automationProgress) s.automationProgress.dailyDate = undefined;
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
      const { decision, quantity: input, note, followUpDays = 2 } = body.data;
      if (decision === "edited" && input == null) throw new InputError("Enter an adjusted quantity.");
      const previous = s.decisions[recommendation.id];
      // Rejection is terminal for this purchase proposal. A retry or a later
      // approval must not turn a rejected proposal into an order update.
      if (recommendation.type === "purchase" && previous?.decision === "rejected") return;
      const quantity = decision === "rejected" ? null : numeric(input ?? (previous?.decision === decision ? previous.quantity : null) ?? recommendation.suggested, "quantity", recommendation.type === "preparation");
      // A repeated decision is a no-op, including after its follow-up was completed.
      // Legacy approvals are deliberately not backfilled through this path.
      if (previous?.decision === decision && previous.quantity === quantity) return;
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
      cancelOutstanding(s, recommendation.id, decision === "rejected" ? "Owner rejected the revised decision." : "Superseded by an owner-approved revision; previous snapshot retained.");
      const approvedAt = new Date().toISOString();
      s.decisions[recommendation.id] = { decision, quantity, original: recommendation.original, savings, approvedAt: quantity === null ? undefined : approvedAt, recommendation: structuredClone(recommendation) };
      // Rejecting a revision must not restore an older, unapproved quantity.
      if (recommendation.type === "purchase" && ingredient && quantity !== null) ingredient.deliveryQuantity = quantity;
      if (quantity !== null && (s.automation?.followUpHandling ?? true)) {
        // Completed observations belong to the old decision, never replace them.
        // Scheduling below only considers outstanding checks for this new revision.
        scheduleFollowUp(s, { ...recommendation, status: decision, approvedQuantity: quantity }, quantity, followUpDays, approvedAt, true);
      }
      s.activity.unshift({ id: crypto.randomUUID(), time: new Date().toISOString(), title: recommendation.title, detail: `${recommendation.description} Owner ${decision}. ${recommendation.original} → ${quantity ?? recommendation.original} ${recommendation.unit}. ${recommendation.type === "purchase" && quantity !== null ? "Internal purchasing plan updated. No supplier order placed." : recommendation.type === "preparation" && quantity !== null ? `Preparation plan saved for ${computed.tomorrow}.` : "No purchasing change."}${note ? ` Note: ${note}` : ""}`, decision, impact: savings });
    });
    res.json(state);
  } catch (err) {
    if (err instanceof InputError) { res.status(400).json({ error: err.message }); return; }
    throw err;
  }
});
router.post("/guard/recommendations/:id/follow-up", async (req, res): Promise<void> => {
  const body = AttachFollowUpBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Choose one or two follow-up days." }); return; }
  try {
    const state = await change(s => {
      const decision = s.decisions[req.params.id as string];
      if (!decision || !["approved", "edited"].includes(decision.decision) || decision.quantity === null) throw new InputError("Only an existing approved recommendation can have a follow-up attached.");
      const recommendation = compute(s).approvedRecommendations.find(r => r.id === req.params.id);
      if (!recommendation) throw new InputError("Original recommendation details are unavailable. Approve a current recommendation to start a new check.");
      scheduleFollowUp(s, { ...recommendation, status: decision.decision, approvedQuantity: decision.quantity }, decision.quantity, body.data.followUpDays ?? 2, decision.approvedAt ?? null);
    });
    res.json(state);
  } catch (err) {
    if (err instanceof InputError) { res.status(400).json({ error: err.message }); return; }
    throw err;
  }
});
router.post("/guard/follow-ups/:id/outcome", async (req, res): Promise<void> => {
  const body = RecordFollowUpOutcomeBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Enter a valid observation date, action taken, and non-negative finite quantities for every ingredient." }); return; }
  try {
    res.json(await change(s => completeFollowUp(s, req.params.id as string, body.data)));
  } catch (err) {
    if (err instanceof InputError) { res.status(400).json({ error: err.message }); return; }
    throw err;
  }
});
export default router;
