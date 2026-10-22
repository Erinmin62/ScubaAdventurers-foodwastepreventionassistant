import { createHash } from "node:crypto";
import { GetReordersResponse, PreviewReorderResponse } from "@workspace/api-zod";
import { compute, today, shift, daysBetween, round, type Stored } from "./guard-model";
import { InputError } from "./guard-follow-ups";
import { stockBatches } from "./guard-batches";

export type Reorders = typeof GetReordersResponse._output;
type Config = Reorders["settings"][number];
type Line = Reorders["analysis"][number];
type Ingredient = Stored["ingredients"][number];
export function configFor(s: Stored, ingredientId: string): Config {
  return s.reordering?.settings.find(c => c.ingredientId === ingredientId) ??
    { ingredientId, leadDays: 2, reviewDays: 2, minOrder: 1, safetyStock: 0, shelfDays: 5 };
}
function fingerprint(s: Stored, id: string): string {
  return createHash("sha256").update(JSON.stringify({
    date: today(), ingredient: s.ingredients.find(i => i.id === id), config: configFor(s, id), sales: s.sales, menu: s.menu,
  })).digest("hex");
}

/** Closing stock today; tomorrow onward, deliveries before consumption, FEFO.
 * Existing incoming is the target order, replaced rather than added a second time.
 * No inventory is consumed or mutated by this simulation.
 */
function simulate(i: Ingredient, usage: number, arrival: string, quantity: number, config: Config, end: string, reviewThrough = shift(arrival, config.reviewDays - 1)) {
  const d = today(), horizon = reviewThrough;
  const batches = [
    ...stockBatches(i).map(b => ({ available: shift(d, 1), expiry: b.expiry, quantity: b.quantity })),
    { available: arrival, expiry: shift(arrival, config.shelfDays - 1), quantity },
  ];
  let waste = 0, shortage = 0, before = 0, eligibleShortage = 0, closing = 0;
  for (let day = shift(d, 1); day <= end; day = shift(day, 1)) {
    for (const b of batches) {
      if (b.available <= day && b.expiry < day) { waste += b.quantity; b.quantity = 0; }
    }
    let need = usage;
    for (const b of batches.sort((a, b) => a.expiry.localeCompare(b.expiry))) {
      if (b.available > day || b.expiry < day) continue;
      const used = Math.min(need, b.quantity); b.quantity -= used; need -= used;
    }
    if (day <= horizon) {
      shortage += need;
      if (day < arrival) before += need;
      if (day >= arrival && day <= shift(arrival, config.shelfDays - 1)) eligibleShortage += need;
    }
    if (day === horizon) closing = batches.filter(b => b.available <= day && b.expiry >= day).reduce((n, b) => n + b.quantity, 0);
  }
  // Count stock remaining at expiry on the last evaluation day.
  waste += batches.filter(b => b.available <= end && b.expiry <= end).reduce((n, b) => n + b.quantity, 0);
  return { waste: round(waste), shortage: round(shortage), before: round(before), eligibleShortage: round(eligibleShortage), closing };
}

export function analyzeReorders(s: Stored): Line[] {
  const state = compute(s), d = today(), tomorrow = shift(d, 1);
  return s.ingredients.map(i => {
    const config = configFor(s, i.id);
    const recipes = s.menu.filter(m => m.recipe.some(r => r.ingredientId === i.id));
    const historyComplete = recipes.length > 0 && recipes.every(m => s.sales.some(r => r.menuId === m.id && r.date >= shift(d, -6) && r.date <= d));
    const usage = config.dailyUsage ?? round(state.forecasts.reduce((n, f) =>
      n + f.predicted * (s.menu.find(m => m.id === f.menuId)?.recipe.find(r => r.ingredientId === i.id)?.amount ?? 0), 0));
    const hasIncoming = i.deliveryQuantity > 0 && i.deliveryDate >= tomorrow;
    const arrival = hasIncoming ? i.deliveryDate : shift(d, config.leadDays);
    const original = hasIncoming ? i.deliveryQuantity : 0;
    const horizon = shift(arrival, config.reviewDays - 1);
    const horizonDays = daysBetween(d, horizon);
    const bounded = horizonDays <= 60;
    const overdue = i.deliveryQuantity > 0 && i.deliveryDate < tomorrow;
    const demandAvailable = (config.dailyUsage !== undefined || historyComplete) && bounded && !overdue;
    const end = [horizon, ...stockBatches(i).filter(b => b.quantity > 0).map(b => b.expiry), shift(arrival, config.shelfDays - 1)].sort().at(-1)!;
    const evaluationEnd = end > shift(d, 90) ? shift(d, 90) : end;
    const safeEnd = bounded ? evaluationEnd : shift(d, 60);
    const empty = simulate(i, usage, arrival, 0, config, safeEnd);
    const needed = empty.eligibleShortage + (config.shelfDays >= config.reviewDays ? Math.max(0, config.safetyStock - empty.closing) : 0);
    const precision = i.unit === "pcs" ? 1 : 100;
    const recommended = demandAvailable && needed > 0.000001 ? Math.ceil(Math.max(needed, config.minOrder) * precision) / precision : 0;
    const baseline = simulate(i, usage, arrival, original, config, safeEnd);
    const proposed = simulate(i, usage, arrival, recommended, config, safeEnd);
    const assumptions = [
      "Synthetic shared demo. Closing stock today; consumption starts tomorrow. Deterministic rules, not evaluated machine learning.",
      config.dailyUsage !== undefined ? `Owner-entered usage assumption: ${usage} ${i.unit}/day.` : `Repeat tomorrow's recipe-based seven-day sales forecast: ${usage} ${i.unit}/day; not a multi-day predictive model.`,
      `${s.reordering?.settings.some(c => c.ingredientId === i.id) ? "Owner-entered assumptions" : "Synthetic defaults (not verified supplier terms)"}: lead ${config.leadDays} days, review ${config.reviewDays} days, minimum ${config.minOrder} ${i.unit}, safety ${config.safetyStock} ${i.unit}, delivered shelf life ${config.shelfDays} days.`,
      "Received stock uses separate expiry batches with FEFO. Incoming quantity is one planned delivery, never already in received stock. Delivery arrives before that day's demand; never use expired stock.",
      `Waste modeled through ${safeEnd}; current stock beyond 90 days is not assessed. Reductions are estimates, not measured outcomes.`,
    ];
    if (!historyComplete && config.dailyUsage === undefined) assumptions.push("Missing recent menu sales or recipe mapping. Configure daily usage before approval; zero demand is not evidence of no demand.");
    if (overdue) assumptions.push("Delivery is dated today or earlier and receipt is unconfirmed. Update pantry delivery/stock records first; it is not counted as available and cannot be silently overwritten.");
    if (!bounded) assumptions.push("Delivery lies beyond the supported 60-day planning horizon. Review the delivery date first.");
    if (config.shelfDays < config.reviewDays) assumptions.push("Delivered shelf life is shorter than the review period. Split/repeat deliveries may be needed; a single order cannot cover later days safely.");
    if (proposed.shortage > proposed.before) assumptions.push(`Residual forecast shortage after arrival: ${round(proposed.shortage - proposed.before)} ${i.unit}; review shelf life, minimums or arrange split deliveries.`);
    if (proposed.waste > baseline.waste) assumptions.push(`The proposed minimum/safety quantity increases modeled expiry waste to ${proposed.waste} ${i.unit} (${round(proposed.waste * i.cost)} RM). Consider a smaller supplier minimum, split delivery, or reviewing safety stock before approving.`);
    const expired = round(stockBatches(i).filter(b => b.expiry < d).reduce((n, b) => n + b.quantity, 0));
    return {
      ingredientId: i.id, name: i.name, photoPath: i.photoPath ?? null, unit: i.unit, unitCost: i.cost, expiry: i.expiry, currentStock: i.quantity, expiredQuantity: expired,
      wasteQuantity: baseline.waste, wasteCost: round(baseline.waste * i.cost),
      incomingQuantity: i.deliveryQuantity, incomingDate: i.deliveryDate, dailyUsage: usage,
      expectedDemand: round(usage * Math.max(0, horizonDays)), originalQuantity: original, recommendedQuantity: recommended, additionalQuantity: round(Math.max(0, recommended - original)),
      deliveryDate: arrival, originalCost: round(original * i.cost), proposedCost: round(recommended * i.cost),
      potentialWasteReduction: round(Math.max(0, baseline.waste - proposed.waste)), shortageBeforeDelivery: proposed.before, config, assumptions, demandAvailable,
      explanation: !demandAvailable ? "Configuration or delivery reconciliation required before any approval." :
        `${recommended === 0 ? "Skip additional purchasing / cancel this planned quantity" : recommended < original ? "Reduce planned purchasing" : recommended > original ? "Increase planned purchasing" : "Keep planned purchasing"}: ${original} → ${recommended} ${i.unit} on ${arrival}. Existing stock is allocated first by expiry; the target incoming delivery is replaced, not counted twice. Expected demand through ${horizon}: ${round(usage * horizonDays)} ${i.unit}. ${baseline.waste > 0 ? `${baseline.waste} ${i.unit} may remain at expiry; use safe stock first, review preparation or isolate expired stock.` : "No modeled expiry waste within the evaluation window."}${proposed.before > 0 ? ` ${proposed.before} ${i.unit} cannot be covered before arrival: arrange an earlier safe source or reduce preparation.` : ""}`,
    };
  });
}

export function reorderState(s: Stored): Reorders {
  return { settings: s.reordering?.settings ?? [], plans: s.reordering?.plans ?? [], lastScan: s.reordering?.lastScan, analysis: analyzeReorders(s) };
}
export function scanReorders(s: Stored) {
  s.reordering ??= { settings: [], plans: [] };
  let count = 0;
  for (const line of analyzeReorders(s)) {
    const hash = fingerprint(s, line.ingredientId);
    if (s.reordering.plans.some(p => p.line.ingredientId === line.ingredientId && p.fingerprint === hash && p.status !== "FAILED")) continue;
    for (const p of s.reordering.plans) if (p.line.ingredientId === line.ingredientId && p.status === "PENDING_APPROVAL") p.status = "SUPERSEDED";
    s.reordering.plans.unshift({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: "PENDING_APPROVAL", fingerprint: hash, line, detail: "" });
    count++;
  }
  s.reordering.lastScan = new Date().toISOString();
  if (count) s.activity.unshift({ id: crypto.randomUUID(), time: s.reordering.lastScan, title: "Waste-aware reorder scan", detail: `${count} simulated order proposals generated. No delivery or inventory changed; human approval required.`, decision: "automation", impact: 0 });
}

/** Read-only scenario analysis. Never execute, log, migrate, or modify a proposal. */
export function previewReorder(s: Stored, id: string, input: { quantity: number; deliveryDate: string }): typeof PreviewReorderResponse._output {
  const plan = s.reordering?.plans.find(p => p.id === id);
  if (!plan) throw new InputError("Proposal not found. Run a reorder scan first.");
  if (plan.status !== "PENDING_APPROVAL") throw new InputError("This proposal is already decided or superseded. Preview a fresh pending proposal.");
  if (plan.fingerprint !== fingerprint(s, plan.line.ingredientId)) throw new InputError("Stock, forecast, date or settings changed. Run a reorder scan for a fresh proposal.");
  if (!plan.line.demandAvailable) throw new InputError("Reconcile missing sales, usage or delivery information before previewing this order.");
  const copy = structuredClone(s);
  const ingredient = copy.ingredients.find(i => i.id === plan.line.ingredientId);
  if (!ingredient) throw new InputError("Ingredient no longer exists.");
  const { quantity, deliveryDate } = input, config = configFor(copy, ingredient.id);
  if (!Number.isFinite(quantity) || quantity < 0 || quantity > 1e6) throw new InputError("Enter a quantity from 0 to 1,000,000.");
  if (ingredient.unit === "pcs" && !Number.isInteger(quantity)) throw new InputError("Orders measured in pieces require whole quantities.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) || !Number.isFinite(Date.parse(deliveryDate)) || new Date(deliveryDate).toISOString().slice(0, 10) !== deliveryDate || deliveryDate <= today() || deliveryDate > shift(today(), 60)) throw new InputError("Choose a valid future delivery date within 60 days.");
  if (deliveryDate !== ingredient.deliveryDate && deliveryDate < shift(today(), config.leadDays)) throw new InputError("New or rescheduled delivery cannot arrive before supplier lead time.");
  const line = analyzeReorders(copy).find(l => l.ingredientId === ingredient.id)!;
  const reviewThrough = shift([line.deliveryDate, deliveryDate].sort().at(-1)!, config.reviewDays - 1);
  const expiryEnd = [
    reviewThrough, shift(line.deliveryDate, config.shelfDays - 1), shift(deliveryDate, config.shelfDays - 1),
    ...stockBatches(ingredient).filter(b => b.quantity > 0).map(b => b.expiry),
  ].sort().at(-1)!;
  const evaluatedThrough = expiryEnd > shift(today(), 90) ? shift(today(), 90) : expiryEnd;
  const scenarioFor = (amount: number, arrival: string) => {
    const result = simulate(ingredient, line.dailyUsage, arrival, amount, config, evaluatedThrough, reviewThrough);
    return {
      quantity: amount, deliveryDate: arrival, purchaseCost: round(amount * ingredient.cost),
      wasteQuantity: result.waste, wasteCost: round(result.waste * ingredient.cost),
      shortageQuantity: result.shortage, shortageBeforeDelivery: result.before, closingStock: round(result.closing),
    };
  };
  const original = scenarioFor(line.originalQuantity, line.deliveryDate);
  const recommended = scenarioFor(line.recommendedQuantity, line.deliveryDate);
  const scenario = scenarioFor(quantity, deliveryDate);
  const approvalAllowed = quantity === 0 || quantity >= config.minOrder;
  const warnings = [
    "Preview only. Estimates use the same daily usage on each day, expiry-batch allocation and delivery-before-consumption assumptions. Not measured savings or a demand guarantee.",
    "Each scenario replaces the one planned incoming delivery; it is not added to it. Received inventory and all purchase records remain unchanged.",
  ];
  if (!approvalAllowed) warnings.push(`Below supplier minimum of ${config.minOrder} ${ingredient.unit}. You can explore this quantity, but approval requires zero or at least the minimum.`);
  if (scenario.shortageBeforeDelivery > 0) warnings.push(`${scenario.shortageBeforeDelivery} ${ingredient.unit} of demand may be unmet before delivery. A larger order on the same date cannot fix earlier shortages.`);
  if (scenario.shortageQuantity > scenario.shortageBeforeDelivery) warnings.push(`${round(scenario.shortageQuantity - scenario.shortageBeforeDelivery)} ${ingredient.unit} of demand may be unmet on or after delivery; review quantity, shelf life or split deliveries.`);
  if (scenario.wasteQuantity > original.wasteQuantity) warnings.push("This scenario increases modeled expiry waste compared with the original order.");
  if (line.expiredQuantity > 0) warnings.push(`${line.expiredQuantity} ${ingredient.unit} is already expired, is never usable, and is included in modeled waste in every scenario.`);
  if (scenario.closingStock < config.safetyStock) warnings.push(`Closing usable stock is below the ${config.safetyStock} ${ingredient.unit} safety-stock assumption.`);
  if (expiryEnd > evaluatedThrough) warnings.push("Waste assessment is capped at 90 days; stock expiring later is not evaluated.");
  return {
    planId: id, unit: ingredient.unit, dailyUsage: line.dailyUsage, reviewThrough, evaluatedThrough,
    original, recommended, scenario, purchaseReduction: round(original.purchaseCost - scenario.purchaseCost),
    wasteReduction: round(original.wasteQuantity - scenario.wasteQuantity), approvalAllowed, warnings,
  };
}

export function decideReorder(s: Stored, id: string, input: { decision: "approve" | "reject"; approver: string; quantity?: number; deliveryDate?: string }, execute?: (i: Ingredient, quantity: number, date: string) => void) {
  const plan = s.reordering?.plans.find(p => p.id === id);
  if (!plan) throw new InputError("Proposal not found. Run analysis first.");
  // Decisions are immutable and terminal. Replays cannot execute, undo or revise.
  if (plan.status !== "PENDING_APPROVAL") return;
  const approver = input.approver.trim();
  if (!approver || approver.length > 80) throw new InputError("Enter an owner name (self-reported demo identity).");
  const now = new Date().toISOString();
  const current = s.ingredients.find(i => i.id === plan.line.ingredientId);
  if (current) Object.assign(plan, { beforeQuantity: current.deliveryQuantity, afterQuantity: current.deliveryQuantity, beforeDate: current.deliveryDate, afterDate: current.deliveryDate });
  if (input.decision === "reject") {
    plan.status = "REJECTED";
    Object.assign(plan, { decidedAt: now, approver, detail: "Owner rejected proposal; no records changed." });
  } else {
    try {
      if (plan.fingerprint !== fingerprint(s, plan.line.ingredientId)) throw new InputError("Stock, forecast, date or settings changed. Run analysis again before approval.");
      if (!plan.line.demandAvailable) throw new InputError("Reconcile missing demand or delivery information first.");
      const ingredient = s.ingredients.find(i => i.id === plan.line.ingredientId);
      if (!ingredient) throw new InputError("Ingredient no longer exists.");
      const quantity = input.quantity ?? plan.line.recommendedQuantity, date = input.deliveryDate ?? plan.line.deliveryDate;
      if (!Number.isFinite(quantity) || quantity < 0 || quantity > 1e6 || (quantity > 0 && quantity < plan.line.config.minOrder)) throw new InputError("Quantity must be finite, nonnegative and meet the minimum order when positive.");
      if (ingredient.unit === "pcs" && !Number.isInteger(quantity)) throw new InputError("Orders measured in pieces require whole quantities.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date <= today() || date > shift(today(), 60)) throw new InputError("Choose a valid future delivery date within 60 days.");
      if (date !== ingredient.deliveryDate && date < shift(today(), plan.line.config.leadDays)) throw new InputError("New or rescheduled delivery cannot arrive before supplier lead time.");
      // Stage changes on a clone: a failure must leave inventory and delivery untouched.
      const staged = structuredClone(ingredient);
      if (execute) execute(staged, quantity, date);
      else { staged.deliveryQuantity = quantity; staged.deliveryDate = date; }
      if (staged.deliveryQuantity !== quantity || staged.deliveryDate !== date || staged.quantity !== ingredient.quantity) throw new InputError("Simulation did not apply the approved delivery exactly.");
      plan.status = "EXECUTED";
      Object.assign(plan, { decidedAt: now, approver, approvedQuantity: quantity, approvedDate: date, beforeQuantity: ingredient.deliveryQuantity, beforeDate: ingredient.deliveryDate, afterQuantity: quantity, afterDate: date, detail: `Simulated delivery updated: ${ingredient.deliveryQuantity} → ${quantity} ${ingredient.unit}, ${ingredient.deliveryDate} → ${date}. Owner ${quantity !== plan.line.recommendedQuantity || date !== plan.line.deliveryDate ? "edited and approved" : "approved"}. No real supplier order placed; stock unchanged.` });
      ingredient.deliveryQuantity = quantity; ingredient.deliveryDate = date;
    } catch (e) {
      plan.status = "FAILED";
      Object.assign(plan, { decidedAt: now, approver, approvedQuantity: input.quantity ?? plan.line.recommendedQuantity, approvedDate: input.deliveryDate ?? plan.line.deliveryDate, detail: `Not executed: ${e instanceof Error ? e.message : "Simulation failed"}. Delivery and inventory unchanged. Run analysis for a fresh proposal.` });
    }
  }
  const audit = current
    ? `Planned delivery: ${plan.beforeQuantity} → ${plan.afterQuantity} ${plan.line.unit}; delivery date: ${plan.beforeDate} → ${plan.afterDate}.`
    : "Ingredient unavailable; no delivery changed.";
  s.activity.unshift({ id: crypto.randomUUID(), time: now, title: `Reorder ${plan.status.toLowerCase()}: ${plan.line.name}`, detail: `Proposal ${plan.id}. ${plan.detail} ${audit} Decision by ${approver} (self-reported demo identity).`, decision: plan.status.toLowerCase(), impact: plan.status === "EXECUTED" ? round(plan.line.originalCost - (plan.approvedQuantity ?? 0) * (s.ingredients.find(i => i.id === plan.line.ingredientId)?.cost ?? 0)) : 0 });
}
