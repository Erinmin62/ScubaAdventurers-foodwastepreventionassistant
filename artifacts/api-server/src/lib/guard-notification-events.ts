import { compute, daysBetween, round, today, type Stored } from "./guard-model";

export type NotificationKind = "expiry" | "recommendations" | "approvals" | "failures" | "completed";
export type NotificationEvent = {
  id: string; kind: NotificationKind; priority: "critical" | "warning" | "upcoming" | "info";
  title: string; text: string; path: string; remind: boolean;
};

/** Only observes existing records; never executes or approves any action. */
export function notificationEvents(s: Stored): NotificationEvent[] {
  const state = compute(s), events: NotificationEvent[] = [], d = today();
  for (const i of s.ingredients) {
    if (i.quantity <= 0) continue;
    const days = daysBetween(d, i.expiry);
    if (days > 7) continue;
    const priority = days <= 0 ? "critical" : days <= 3 ? "warning" : "upcoming";
    const risk = state.risks.find(r => r.ingredientId === i.id);
    const action = days < 0 ? "Isolate expired food and arrange safe disposal. Do not consume, prepare or sell it."
      : days === 0 ? "Review stock that expires today and food-safety requirements. Do not include it in tomorrow's preparation."
      : "Prioritise safe first-expiring stock in compatible recipes within expected demand; review replenishment.";
    events.push({
      id: `expiry:${i.id}:${i.expiry}:${priority}`, kind: "expiry", priority,
      title: `${priority === "critical" ? "Critical expiry" : priority === "warning" ? "Expiry warning" : "Upcoming expiry"}: ${i.name}`,
      text: `${i.name}: ${i.quantity} ${i.unit}, expiry ${i.expiry}${days < 0 ? " (already expired)" : days === 0 ? " (today)" : ` (in ${days} days)`}. Estimated inventory value: RM${round(i.quantity * i.cost).toFixed(2)}.${risk ? ` Estimated unused-stock value at risk: RM${risk.value.toFixed(2)}.` : ""} ${action}`,
      path: "/inventory", remind: true,
    });
  }
  const threshold = s.notifications?.settings.riskThreshold ?? 50;
  for (const risk of state.risks.filter(r => r.value >= threshold && r.atRisk > 0 && r.level !== "low")) {
    const rec = state.recommendations.find(r => r.targetId === risk.ingredientId && r.status === "pending" && r.type === "use-first")
      ?? state.recommendations.find(r => r.targetId === risk.ingredientId && r.status === "pending" && r.type === "purchase");
    // Only describe a recommendation that actually exists, not an invented action.
    if (rec) events.push({
      id: `recommendation:${rec.id}`, kind: "recommendations", priority: "warning",
      title: `Prevention recommendation: ${risk.name}`,
      text: `${rec.title}. ${rec.description} Estimated unused-stock value at risk: RM${risk.value.toFixed(2)}. This is a rule-based estimate, not measured savings. Your review is required.`,
      path: "/recommendations", remind: true,
    });
  }
  for (const p of s.reordering?.plans ?? []) {
    if (p.status === "PENDING_APPROVAL") events.push({
      id: `approval:${p.id}`, kind: "approvals", priority: "warning",
      title: `Approval required: ${p.line.name}`,
      text: p.line.demandAvailable
        ? `${p.line.explanation} Proposed incoming quantity: ${p.line.originalQuantity} → ${p.line.recommendedQuantity} ${p.line.unit}, delivery ${p.line.deliveryDate}; estimated proposed cost RM${p.line.proposedCost.toFixed(2)}. Review, edit, approve or reject in the app before any simulated order is changed.`
        : `${p.line.name} needs manual data reconciliation before approval. ${p.line.explanation} Review stock, delivery receipt/date and demand assumptions. No order has changed.`,
      path: "/reordering", remind: true,
    });
    if (p.status === "FAILED") events.push({
      id: `failure:${p.id}`, kind: "failures", priority: "critical",
      title: `Action requires attention: ${p.line.name}`, text: p.detail,
      path: "/reordering", remind: false,
    });
    if (p.status === "EXECUTED") events.push({
      id: `completed:${p.id}`, kind: "completed", priority: "info",
      title: `Simulated action completed: ${p.line.name}`, text: `${p.detail} This is an internal simulated purchase plan, not confirmation from a supplier.`,
      path: "/reordering", remind: false,
    });
  }
  // Legacy consequential purchase and preparation actions retain their own UI.
  for (const r of state.recommendations.filter(r => r.status === "pending" && r.type !== "use-first")) events.push({
    id: `legacy-approval:${r.id}`, kind: "approvals", priority: "info",
    title: `Review required: ${r.title}`, text: `${r.description} Owner approval is required; this message never changes a plan.`,
    path: "/recommendations", remind: true,
  });
  for (const a of s.activity.filter(a => a.decision === "workflow-failed")) events.push({
    id: `workflow:${a.id}`, kind: "failures", priority: "critical",
    title: a.title, text: a.detail, path: "/automation", remind: false,
  });
  const rank = { critical: 0, warning: 1, upcoming: 2, info: 3 };
  return events.sort((a, b) => rank[a.priority] - rank[b.priority]);
}
