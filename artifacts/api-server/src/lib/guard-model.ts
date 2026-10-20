import { GetGuardStateResponse } from "@workspace/api-zod";

export type State = typeof GetGuardStateResponse._output;
export type Stored = Pick<State, "ingredients" | "sales" | "results" | "menu" | "activity"> & {
  followUps?: State["followUps"];
  decisions: Record<string, { decision: string; quantity: number | null; original: number; savings: number; approvedAt?: string; recommendation?: State["recommendations"][number] }>;
  baseline: { wasteCost: number; wasteKg: number };
};
export const round = (n: number) => Math.round(n * 100) / 100;
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export function shift(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export function seed(): Stored {
  const d = today();
  const ingredients: State["ingredients"] = [
    { id: "tomato", name: "Cherry tomatoes", quantity: 6, unit: "kg", expiry: shift(d, 2), cost: 12, category: "Vegetables", deliveryQuantity: 4, deliveryDate: shift(d, 1) },
    { id: "avocado", name: "Avocados", quantity: 4.5, unit: "kg", expiry: shift(d, 1), cost: 24, category: "Produce", deliveryQuantity: 3, deliveryDate: shift(d, 2) },
    { id: "spinach", name: "Baby spinach", quantity: 2.8, unit: "kg", expiry: shift(d, 1), cost: 16, category: "Vegetables", deliveryQuantity: 2, deliveryDate: shift(d, 1) },
    { id: "bread", name: "Sourdough bread", quantity: 6, unit: "kg", expiry: shift(d, 3), cost: 10, category: "Bakery", deliveryQuantity: 4, deliveryDate: shift(d, 2) },
    { id: "chicken", name: "Chicken breast", quantity: 8, unit: "kg", expiry: shift(d, 4), cost: 18, category: "Protein", deliveryQuantity: 5, deliveryDate: shift(d, 2) },
    { id: "pasta", name: "Penne pasta", quantity: 10, unit: "kg", expiry: shift(d, 60), cost: 8, category: "Pantry", deliveryQuantity: 0, deliveryDate: shift(d, 7) },
    { id: "milk", name: "Fresh milk", quantity: 12, unit: "L", expiry: shift(d, 3), cost: 7, category: "Dairy", deliveryQuantity: 8, deliveryDate: shift(d, 1) },
    { id: "coffee", name: "Coffee beans", quantity: 3, unit: "kg", expiry: shift(d, 30), cost: 65, category: "Pantry", deliveryQuantity: 2, deliveryDate: shift(d, 4) },
    { id: "cream", name: "Whipping cream", quantity: 0.8, unit: "L", expiry: shift(d, -1), cost: 18, category: "Dairy", deliveryQuantity: 0, deliveryDate: shift(d, 3) },
  ];
  const menu: State["menu"] = [
    { id: "avo-toast", name: "Avocado Toast", price: 22, cost: 7.5, recipe: [{ ingredientId: "avocado", amount: 0.09 }, { ingredientId: "bread", amount: 0.08 }, { ingredientId: "tomato", amount: 0.04 }] },
    { id: "chicken-bowl", name: "Harvest Chicken Bowl", price: 28, cost: 9, recipe: [{ ingredientId: "chicken", amount: 0.15 }, { ingredientId: "spinach", amount: 0.05 }, { ingredientId: "tomato", amount: 0.08 }] },
    { id: "tomato-pasta", name: "Garden Tomato Pasta", price: 24, cost: 6, recipe: [{ ingredientId: "pasta", amount: 0.1 }, { ingredientId: "tomato", amount: 0.12 }, { ingredientId: "spinach", amount: 0.025 }] },
    { id: "latte", name: "Signature Latte", price: 13, cost: 3.2, recipe: [{ ingredientId: "milk", amount: 0.2 }, { ingredientId: "coffee", amount: 0.018 }] },
  ];
  const sales: State["sales"] = [];
  const results: State["results"] = [];
  for (let day = -28; day <= 0; day++) {
    menu.forEach((item, index) => {
      const weekend = [0, 6].includes(new Date(`${shift(d, day)}T00:00Z`).getUTCDay());
      const portions = Math.round(([24, 19, 17, 42][index]! + ((day * 7 + index * 3 + 84) % 9) - 4) * (weekend ? 1.22 : 1));
      sales.push({ date: shift(d, day), menuId: item.id, portions });
      if (day < 0) {
        const leftover = day < -7 ? 5 + index : 1 + ((day + 28 + index) % 3);
        results.push({ date: shift(d, day), menuId: item.id, prepared: portions + leftover, sold: portions, leftover });
      }
    });
  }
  const baselineResults = results.filter(r => r.date >= shift(d, -13) && r.date < shift(d, -6));
  const wasteCost = baselineResults.reduce((s, r) => s + r.leftover * menu.find(m => m.id === r.menuId)!.cost, 0);
  const wasteKg = baselineResults.reduce((s, r) => s + r.leftover * menu.find(m => m.id === r.menuId)!.recipe.reduce((a, v) => a + (ingredients.find(i => i.id === v.ingredientId)?.unit === "kg" ? v.amount : 0), 0), 0);
  return { ingredients, menu, sales, results, decisions: {}, baseline: { wasteCost, wasteKg }, activity: [{ id: crypto.randomUUID(), time: new Date().toISOString(), title: "Your café workspace is ready", detail: "28 days of synthetic sales and waste results loaded. No real orders are placed.", decision: "system", impact: 0 }] };
}

export function compute(s: Stored): State {
  const d = today(), tomorrow = shift(d, 1);
  const weekday = new Date(`${tomorrow}T00:00Z`).getUTCDay();
  const available = Object.fromEntries(s.ingredients.map(i => [i.id, i.expiry >= tomorrow ? i.quantity : 0]));
  const forecasts: State["forecasts"] = s.menu.map(m => {
    const history = s.sales.filter(r => r.menuId === m.id && r.date <= d && r.date >= shift(d, -6));
    const avg = history.length ? history.reduce((n, r) => n + r.portions, 0) / history.length : 0;
    const factor = [0, 6].includes(weekday) ? 1.15 : 0.97;
    const predicted = Math.max(0, Math.round(avg * factor));
    const capacity = Math.max(0, Math.floor(Math.min(...m.recipe.map(r => (available[r.ingredientId] ?? 0) / r.amount))));
    const suggested = Math.min(capacity, predicted);
    for (const r of m.recipe) available[r.ingredientId] = Math.max(0, (available[r.ingredientId] ?? 0) - suggested * r.amount);
    return { menuId: m.id, name: m.name, predicted, capacity, suggested, confidence: history.length >= 7 ? "High" : "Limited data", reason: `${history.length}-day mean × ${factor} ${[0, 6].includes(weekday) ? "weekend" : "weekday"} factor. Stock shared across menu items; expired stock excluded. Rules-based estimate, not a guarantee.` };
  });
  const dailyUse = (id: string) => forecasts.reduce((n, f) => n + f.predicted * (s.menu.find(m => m.id === f.menuId)?.recipe.find(r => r.ingredientId === id)?.amount ?? 0), 0);
  const risks: State["risks"] = s.ingredients.map(i => {
    const daysLeft = daysBetween(d, i.expiry);
    const expectedUse = round(dailyUse(i.id) * Math.max(0, daysLeft));
    const atRisk = round(Math.max(0, i.quantity - expectedUse));
    const level = daysLeft < 0 ? "expired" : daysLeft <= 1 && atRisk > 0 ? "critical" : atRisk > 0 && daysLeft <= 4 ? "high" : daysLeft <= 3 ? "watch" : "low";
    return { ingredientId: i.id, name: i.name, daysLeft, level, expectedUse, atRisk, value: round(atRisk * i.cost), message: daysLeft < 0 ? "Expired — isolate and discard safely. Never use in preparation." : daysLeft === 0 ? "Expires today. Do not use in tomorrow's plan." : atRisk > 0 ? `${atRisk} ${i.unit} may remain unused before expiry. Prioritize safe stock first.` : "Expected demand covers stock before expiry." };
  });
  const recommendations: State["recommendations"] = [];
  const add = (r: Omit<State["recommendations"][number], "status" | "approvedQuantity">) => {
    const decision = s.decisions[r.id];
    recommendations.push({ ...r, ...(decision ? { original: decision.original, savings: decision.savings } : {}), status: decision?.decision ?? "pending", approvedQuantity: decision?.quantity ?? null });
  };
  for (const f of forecasts) add({ id: `${tomorrow}:prep:${f.menuId}`, type: "preparation", targetId: f.menuId, title: `Prepare ${f.suggested} ${f.name}`, description: f.reason, original: f.predicted, suggested: f.suggested, unit: "portions", savings: 0 });
  for (const i of s.ingredients) {
    const daily = dailyUse(i.id);
    const leadDays = Math.max(1, daysBetween(d, i.deliveryDate));
    const remainingAtDelivery = i.expiry >= i.deliveryDate ? Math.max(0, i.quantity - daily * Math.max(0, leadDays - 1)) : 0;
    const need = round(Math.max(0, daily * 2 - remainingAtDelivery));
    const purchaseId = `${tomorrow}:purchase:${i.id}`;
    if (i.deliveryQuantity > 0 || need > 0 || s.decisions[purchaseId]) add({ id: purchaseId, type: "purchase", targetId: i.id, title: need < i.deliveryQuantity ? `Reduce the next ${i.name.toLowerCase()} order` : `Review ${i.name.toLowerCase()} purchasing`, description: `Current stock: ${i.quantity} ${i.unit}. Forecast use: ${round(daily)} ${i.unit}/day. Plan ${need} ${i.unit} for the ${i.deliveryDate} delivery and following day, considering expiry. This only changes your internal purchasing plan.`, original: i.deliveryQuantity, suggested: need, unit: i.unit, savings: round(Math.max(0, i.deliveryQuantity - need) * i.cost) });
    const risk = risks.find(r => r.ingredientId === i.id)!;
    if (risk.daysLeft >= 1 && risk.daysLeft <= 3) add({ id: `${tomorrow}:first:${i.id}`, type: "use-first", targetId: i.id, title: `Use ${i.name.toLowerCase()} first`, description: `${risk.message} Use first-expiring safe stock in compatible menu recipes. Do not exceed forecast portions to use up stock.`, original: i.quantity, suggested: round(Math.min(i.quantity, daily)), unit: i.unit, savings: 0 });
  }
  const recent = s.results.filter(r => r.date >= shift(d, -6) && r.date <= d);
  const actualWasteCost = round(recent.reduce((n, r) => n + r.leftover * (s.menu.find(m => m.id === r.menuId)?.cost ?? 0), 0));
  const actualWasteKg = round(recent.reduce((n, r) => n + r.leftover * (s.menu.find(m => m.id === r.menuId)?.recipe.reduce((a, v) => a + (s.ingredients.find(i => i.id === v.ingredientId)?.unit === "kg" ? v.amount : 0), 0) ?? 0), 0));
  const purchaseRecs = recommendations.filter(r => r.type === "purchase");
  const baselinePurchaseCost = round(purchaseRecs.reduce((n, r) => n + r.original * (s.ingredients.find(i => i.id === r.targetId)?.cost ?? 0), 0));
  const plannedPurchaseCost = round(purchaseRecs.reduce((n, r) => n + (r.approvedQuantity ?? r.original) * (s.ingredients.find(i => i.id === r.targetId)?.cost ?? 0), 0));
  const approvedRecommendations: State["recommendations"] = Object.entries(s.decisions).flatMap(([id, decision]) => {
    if (!["approved", "edited"].includes(decision.decision) || decision.quantity === null) return [];
    const known = decision.recommendation;
    if (known) return [{ ...known, status: decision.decision, approvedQuantity: decision.quantity }];
    // Legacy decisions retained IDs/amounts but no original wording or timestamp.
    // Expose only those known facts, clearly marked, for explicit attachment.
    const [, kind, targetId] = id.split(":");
    const type = kind === "prep" ? "preparation" : kind === "first" ? "use-first" : kind === "purchase" ? "purchase" : null;
    const target = type === "preparation" ? s.menu.find(m => m.id === targetId) : s.ingredients.find(i => i.id === targetId);
    if (!type || !target || !targetId) return [];
    return [{ id, type, targetId, title: `Previously approved ${type}: ${target.name}`, description: "Legacy decision: original recommendation wording, approval time and historical stock were not saved. Only the recorded action and amounts are known. A follow-up starts from an explicitly attached current snapshot.", original: decision.original, suggested: decision.quantity, unit: "unit" in target ? target.unit : "portions", savings: decision.savings, status: decision.decision, approvedQuantity: decision.quantity }];
  });
  return { today: d, tomorrow, cafeName: "Little Leaf Café", synthetic: true, ingredients: s.ingredients, sales: s.sales, results: s.results, menu: s.menu, forecasts, risks, recommendations, activity: s.activity, followUps: s.followUps ?? [], approvedRecommendations, summary: { predictedPortions: forecasts.reduce((n, f) => n + f.predicted, 0), riskValue: round(risks.filter(r => r.level !== "low").reduce((n, r) => n + r.value, 0)), pendingCount: recommendations.filter(r => r.status === "pending").length, estimatedSavings: round(Math.max(0, baselinePurchaseCost - plannedPurchaseCost)), baselineWasteCost: round(s.baseline.wasteCost), actualWasteCost, baselinePurchaseCost, plannedPurchaseCost, baselineWasteKg: round(s.baseline.wasteKg), actualWasteKg } };
}
