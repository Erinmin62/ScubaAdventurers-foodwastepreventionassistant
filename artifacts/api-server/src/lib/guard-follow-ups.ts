import { type State, type Stored, compute, daysBetween, round, shift, today } from "./guard-model";

export class InputError extends Error {}
type FollowUp = State["followUps"][number];

export function validDate(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)
    throw new InputError(`${field} must be a valid YYYY-MM-DD date.`);
  return value;
}

export function cancelOutstanding(s: Stored, recommendationId: string, reason: string) {
  for (const f of s.followUps ?? []) {
    if (f.recommendationId !== recommendationId || f.status !== "outstanding") continue;
    f.status = "cancelled";
    f.cancellationReason = reason;
    s.activity.unshift({ id: crypto.randomUUID(), time: new Date().toISOString(), title: `Follow-up cancelled: ${f.name}`, detail: `${reason} Original estimate and snapshot retained in follow-up history.`, decision: "cancelled", impact: 0 });
  }
}

export function scheduleFollowUp(s: Stored, recommendation: State["recommendations"][number], quantity: number, days: 1 | 2, approvedAt: string | null, newRevision = false) {
  s.followUps ??= [];
  // Explicit attachment and network retries must not duplicate a decision's check.
  if (s.followUps.some(f => f.recommendationId === recommendation.id && (f.status === "outstanding" || (!newRevision && f.status === "completed")))) return;
  const state = compute(s);
  const dish = recommendation.type === "preparation" ? s.menu.find(m => m.id === recommendation.targetId) : undefined;
  const ids = dish ? [...new Set(dish.recipe.map(r => r.ingredientId))] : [recommendation.targetId];
  const startingDate = today(), scheduledDate = shift(startingDate, days);
  const ingredients = ids.map(id => {
    const stock = s.ingredients.find(i => i.id === id);
    if (!stock) throw new InputError("A tracked ingredient is missing. Update the inventory before attaching a follow-up.");
    // Forecast usage only: no planned delivery is treated as received stock.
    // The approved dish replaces that dish's predicted portions on the first planning day.
    const daily = state.forecasts.reduce((n, f) => n + f.predicted * (s.menu.find(m => m.id === f.menuId)?.recipe.find(r => r.ingredientId === id)?.amount ?? 0), 0);
    const dishForecast = dish ? state.forecasts.find(f => f.menuId === dish.id)?.predicted ?? 0 : 0;
    const recipeAmount = dish?.recipe.find(r => r.ingredientId === id)?.amount ?? 0;
    const safeDays = Math.max(0, Math.min(days, daysBetween(startingDate, stock.expiry)));
    const usage = Math.max(0, daily * safeDays + (safeDays > 0 ? (dish ? (quantity - dishForecast) * recipeAmount : recommendation.type === "use-first" ? quantity - daily : 0) : 0));
    return {
      ingredientId: id, name: stock.name, unit: stock.unit, startingQuantity: stock.quantity, expiry: stock.expiry,
      deliveryQuantity: stock.deliveryQuantity, deliveryDate: stock.deliveryDate,
      expectedUsage: round(usage), expectedRemaining: round(Math.max(0, stock.quantity - usage)),
    };
  });
  const f: FollowUp = {
    id: crypto.randomUUID(), recommendationId: recommendation.id, recommendation: structuredClone(recommendation),
    approvedAction: recommendation.type, approvedQuantity: quantity, approvedAt, snapshotAt: new Date().toISOString(),
    startingDate, scheduledDate, name: dish?.name ?? ingredients[0]!.name, status: "outstanding", ingredients,
    outcome: null, cancellationReason: null,
  };
  s.followUps.push(f);
  s.activity.unshift({ id: crypto.randomUUID(), time: f.snapshotAt, title: `Follow-up scheduled: ${f.name}`, detail: `Check on ${scheduledDate}. Stock snapshot from ${startingDate}; ${approvedAt ? `approval time ${approvedAt}; snapshot time ${f.snapshotAt}` : "historical approval time and historical stock are unknown; current snapshot explicitly attached"}. Approved ${quantity} ${recommendation.unit}. ${ingredients.map(i => `${i.name}: starting ${i.startingQuantity} ${i.unit}, expires ${i.expiry}, forecast usage ${i.expectedUsage}, remaining estimate ${i.expectedRemaining} ${i.unit}`).join("; ")}. Forecast is not a stock ledger; deliveries are not assumed received.`, decision: "follow-up", impact: 0 });
}

export type OutcomeInput = {
  observationDate: string; actionTaken: string; updateInventory: boolean;
  rows: { ingredientId: string; remaining: number; wasted: number }[];
};

export function completeFollowUp(s: Stored, id: string, input: OutcomeInput) {
  const f = s.followUps?.find(f => f.id === id);
  if (!f) throw new InputError("Follow-up not found.");
  if (f.status !== "outstanding") throw new InputError("This follow-up is already completed or cancelled. Its observation is preserved.");
  const observationDate = validDate(input.observationDate, "Observation date");
  if (observationDate < f.startingDate || observationDate > today()) throw new InputError(`Observation date must be between ${f.startingDate} and ${today()} (Kuala Lumpur).`);
  const actionTaken = input.actionTaken.trim();
  if (!actionTaken || actionTaken.length > 1000) throw new InputError("Action taken is required (max 1,000 characters).");
  if (input.rows.length !== f.ingredients.length || new Set(input.rows.map(r => r.ingredientId)).size !== f.ingredients.length || input.rows.some(r => !f.ingredients.some(i => i.ingredientId === r.ingredientId)))
    throw new InputError("Provide exactly one outcome row for every snapshot ingredient.");
  // Validate the whole request before changing any in-memory inventory.
  for (const row of input.rows) for (const q of [row.remaining, row.wasted])
    if (typeof q !== "number" || !Number.isFinite(q) || q < 0 || q > 1000000) throw new InputError("Quantities must be non-negative finite numbers (max 1,000,000).");
  const rows = input.rows.map(row => {
    const i = f.ingredients.find(i => i.ingredientId === row.ingredientId)!;
    const stock = s.ingredients.find(i => i.id === row.ingredientId);
    let assessment: string, nextAction: string;
    if (row.remaining > 0 && i.expiry < observationDate) {
      assessment = "expired stock requiring safe disposal";
      nextAction = "Isolate and safely discard expired stock. Never use it in dishes. Review the next delivery with owner approval.";
    } else if (observationDate !== f.scheduledDate) {
      assessment = "insufficient information to assess";
      nextAction = "This observation is not on the forecast check date. Review current safe stock and delivery adjustments before approving a new plan.";
    } else if (row.remaining > 0 && (i.expiry <= shift(observationDate, 1) || row.remaining > i.expectedRemaining + Math.max(0.01, i.startingQuantity * 0.1))) {
      assessment = "unresolved excess/expiry risk";
      nextAction = "Review the next delivery; prioritize still-safe stock in compatible dishes before expiry. Any new purchasing or preparation change needs owner approval.";
    } else {
      assessment = "stock on track";
      nextAction = "Continue checking expiry labels and current stock. Review any new plan before approving it.";
    }
    let inventoryUpdate = "Not requested; current inventory unchanged.";
    if (input.updateInventory) {
      if (!stock || stock.unit !== i.unit) inventoryUpdate = "Not updated: ingredient missing or unit changed.";
      else if (stock.measuredDate && observationDate <= stock.measuredDate) inventoryUpdate = `Not updated: current measurement is dated ${stock.measuredDate} (same day or newer).`;
      else if (!stock.measuredDate && observationDate < today()) inventoryUpdate = "Not updated: current measurement date is unknown; historical observation retained only.";
      else {
        stock.quantity = row.remaining;
        stock.measuredDate = observationDate;
        inventoryUpdate = `Updated current measured stock to ${row.remaining} ${i.unit} as observed ${observationDate}.`;
      }
    }
    return { ...row, assessment, nextAction, inventoryUpdate };
  });
  f.status = "completed";
  f.outcome = { observationDate, actionTaken, recordedAt: new Date().toISOString(), rows };
  s.activity.unshift({
    id: crypto.randomUUID(), time: f.outcome.recordedAt, title: `Follow-up completed: ${f.name}`, decision: "completed", impact: 0,
    detail: `Observed ${observationDate}; scheduled ${f.scheduledDate}. Action taken: ${actionTaken}. ${rows.map(r => {
      const i = f.ingredients.find(i => i.ingredientId === r.ingredientId)!;
      return `${i.name}: actual remaining ${r.remaining} vs forecast estimate ${i.expectedRemaining} ${i.unit}; ingredient discarded since ${f.startingDate}: ${r.wasted} ${i.unit}. ${r.assessment}. Next action: ${r.nextAction} ${r.inventoryUpdate}`;
    }).join(" ")} Deliveries and other adjustments may affect the comparison. Remaining stock alone does not establish consumption or causal waste reduction. Ingredient discards are separate from prepared-food leftovers and are not added to waste/savings totals. No orders placed.`,
  });
}
