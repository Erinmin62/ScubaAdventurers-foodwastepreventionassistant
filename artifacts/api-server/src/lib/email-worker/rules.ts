import { createHash } from "node:crypto";
import { stockBatches } from "../guard-batches";
import { compute, daysBetween, type Stored } from "../guard-model";

export const EMAIL_TIME_ZONE = "Asia/Kuala_Lumpur";
export type EmailKind = "critical_expiry" | "daily_digest" | "approval_initial" | "approval_reminder";
export type EmailMessage = { subject: string; text: string };
export type EmailCandidate = {
  kind: EmailKind; eventKey: string; relatedIds: string[]; message: EmailMessage;
};
export type CandidateScan = {
  candidates: EmailCandidate[]; ingredientsChecked: number; batchesChecked: number;
  actionsChecked: number; invalidRecords: number;
};
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export function klDay(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EMAIL_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}
export function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
const footer = "\n\nOpen ExpiryGuardAI and review current records. This email never approves or executes an action. Workspace data may include synthetic samples. Values are inventory estimates in RM, not realised savings. Do not consume, prepare or sell expired food.";
const brief = (value: string) => value.replace(/[\r\n]+/g, " ").slice(0, 250);

/** Pure observation. Date-only expiry uses start-of-date in KL conservatively for alert timing. */
export function scanEmailCandidates(s: Stored, now: Date): CandidateScan {
  if (![s.ingredients, s.menu, s.sales, s.results].every(Array.isArray)) throw new Error("invalid_workspace");
  const day = klDay(now);
  const scan: CandidateScan = { candidates: [], ingredientsChecked: 0, batchesChecked: 0, actionsChecked: 0, invalidRecords: 0 };
  const digest: { id: string; text: string }[] = [];
  for (const ingredient of s.ingredients) {
    scan.ingredientsChecked++;
    for (const batch of stockBatches(ingredient)) {
      scan.batchesChecked++;
      if (!isDate(batch.expiry) || !Number.isFinite(batch.quantity) || batch.quantity < 0 ||
          !Number.isFinite(ingredient.cost) || ingredient.cost < 0 ||
          !Number.isFinite(batch.quantity * ingredient.cost)) { scan.invalidRecords++; continue; }
      if (batch.quantity === 0) continue;
      const relation = JSON.stringify([ingredient.id, batch.id, batch.expiry]);
      const label = `${brief(ingredient.name)}: ${batch.quantity} ${brief(ingredient.unit)}, batch expiry ${batch.expiry}. Estimated stock value RM${(batch.quantity * ingredient.cost).toFixed(2)}.`;
      const expiresAt = Date.parse(`${batch.expiry}T00:00:00+08:00`);
      if (expiresAt <= now.getTime() + 24 * 60 * 60 * 1000) {
        const timing = batch.expiry < day ? "Already expired: isolate and arrange safe disposal."
          : batch.expiry === day ? "Labelled to expire today: check food-safety requirements."
          : "Expiry date begins within 24 hours: review urgently.";
        scan.candidates.push({
          kind: "critical_expiry", eventKey: `expiry:${relation}`, relatedIds: [ingredient.id, batch.id],
          message: { subject: `Critical expiry: ${brief(ingredient.name)}`, text: `${label}\n${timing}${footer}` },
        });
      } else if ([2, 3].includes(daysBetween(day, batch.expiry))) {
        digest.push({ id: relation, text: label });
      }
    }
  }
  if (digest.length) {
    digest.sort((a, b) => a.id.localeCompare(b.id));
    scan.candidates.push({
      kind: "daily_digest", eventKey: `digest:${day}`, relatedIds: digest.map(row => row.id),
      message: {
        subject: `Expiry digest — ${day} (Kuala Lumpur)`,
        text: `Ingredients with expiry dates 2–3 calendar days away:\n\n${digest.map(row => `- ${row.text}`).join("\n")}\n\nCritical items are sent separately. Review safe first-expiring stock within expected demand; do not increase preparation merely to use up stock.${footer}`,
      },
    });
  }
  for (const plan of s.reordering?.plans ?? []) {
    scan.actionsChecked++;
    if (plan.status !== "PENDING_APPROVAL") continue;
    scan.candidates.push({
      kind: "approval_initial", eventKey: `reorder:${plan.id}`, relatedIds: [plan.id, plan.line.ingredientId],
      message: { subject: `Approval required: ${brief(plan.line.name)}`,
        text: `A saved reorder proposal is waiting for your review: ${brief(plan.line.name)}.\nReview the proposed quantities, delivery date, costs and current stock in Reordering. No order has been placed.${footer}` },
    });
  }
  // Observe existing derived review actions without running workflows, migrations, or inbox synchronisation.
  // Ignore date-key regeneration when identifying an otherwise identical unresolved review.
  const state = scan.invalidRecords === 0 ? compute(structuredClone(s), day) : { recommendations: [] };
  for (const recommendation of state.recommendations) {
    scan.actionsChecked++;
    if (recommendation.status !== "pending" || recommendation.type === "use-first") continue;
    const stableReview = hash(JSON.stringify([
      recommendation.type, recommendation.targetId, recommendation.original, recommendation.suggested,
      recommendation.unit, s.menuRevision ?? 0,
      Object.entries(s.decisions).filter(([, decision]) =>
        decision.recommendation?.targetId === recommendation.targetId &&
        decision.recommendation.type === recommendation.type && decision.decision !== "pending",
      ).map(([id, decision]) => [id, decision.decision, decision.approvedAt ?? null]).sort(),
    ]));
    scan.candidates.push({
      kind: "approval_initial", eventKey: `review:${stableReview}`, relatedIds: [recommendation.id, recommendation.targetId],
      message: { subject: `Review required: ${brief(recommendation.title)}`,
        text: `${brief(recommendation.title)}\n${recommendation.description}\nReview the latest proposal in Decisions. This is decision support, not a supplier order.${footer}` },
    });
  }
  return scan;
}
