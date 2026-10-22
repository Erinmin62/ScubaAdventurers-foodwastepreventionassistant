import { seed } from "../guard-model";
import { analyzeReorders } from "../guard-reorder";
import { hash } from "./rules";
import type { EmailRecord, EmailRepository, WorkspaceRecord } from "./repository";
import type { SendResult } from "./sender";

export const testRoute = { workspaceId: "owner:email_worker_test", recipient: "owner@example.invalid", recipientHash: hash("owner@example.invalid") };
export function sampleEmailWorkspace(now = new Date("2026-10-22T02:00:00Z")) {
  const state = seed();
  const line = analyzeReorders(state)[0]!;
  state.ingredients = [{
    ...state.ingredients[0]!, id: "test-tomato", name: "Test tomatoes", quantity: 2, cost: 10,
    expiry: "2026-10-23", deliveryQuantity: 0, batches: undefined,
  }];
  state.menu = []; state.sales = []; state.results = []; state.decisions = {};
  state.reordering = {
    settings: [], plans: [{
      id: "approval-test", createdAt: now.toISOString(), fingerprint: "test-only",
      status: "PENDING_APPROVAL", detail: "", line,
    }],
  };
  return state;
}

/** Tests only. The production runner exclusively uses PostgreSQL. */
export class MemoryEmailRepository implements EmailRepository {
  rows = new Map<string, EmailRecord>();
  expiryCheckStatuses = new Map<string, { outcome: "success" | "failed"; completedAt: string }>();
  writes = 0;
  locked = false;
  constructor(public workspaceRows: WorkspaceRecord[]) {}
  async lock() { if (this.locked) return false; this.locked = true; return true; }
  async unlock() { this.locked = false; }
  async recoverInterrupted() {
    let count = 0;
    for (const row of this.rows.values()) if (row.status === "sending") { row.status = "uncertain"; count++; this.writes++; }
    return count;
  }
  async workspaces(ids?: string[]) { return structuredClone(this.workspaceRows.filter(row => !ids || ids.includes(row.id))); }
  async workspace(id: string) { return structuredClone(this.workspaceRows.find(row => row.id === id) ?? null); }
  async records(workspaceId: string, recipientHash: string) {
    return structuredClone([...this.rows.values()].filter(row => row.workspaceId === workspaceId && row.recipientHash === recipientHash));
  }
  async enqueue(row: EmailRecord) {
    const old = this.rows.get(row.id);
    if (!old || old.status === "cancelled" && old.attempts === 0) {
      this.rows.set(row.id, structuredClone(row)); this.writes++;
    }
  }
  async cancelInactive(workspaceId: string, recipientHash: string, activeIds: string[]) {
    let count = 0;
    for (const row of this.rows.values()) if (row.workspaceId === workspaceId && row.status === "queued" &&
      (row.recipientHash !== recipientHash || !activeIds.includes(row.id))) { row.status = "cancelled"; this.writes++; count++; }
    return count;
  }
  async cancel(id: string) {
    const row = this.rows.get(id);
    if (row?.status === "queued") { row.status = "cancelled"; this.writes++; }
  }
  async startAttempt(id: string, message: EmailRecord["message"], _at: string) {
    const row = this.rows.get(id);
    if (!row || row.status !== "queued" || row.attempts !== 0) return false;
    row.status = "sending"; row.message = structuredClone(message); row.attempts++; this.writes++; return true;
  }
  async finishAttempt(id: string, result: SendResult, at: string) {
    const row = this.rows.get(id)!;
    row.status = result.status;
    if (result.status === "accepted") row.acceptedAt = at;
    this.writes++;
  }
  async saveExpiryCheckStatus(workspaceId: string, outcome: "success" | "failed", completedAt: string) {
    this.expiryCheckStatuses.set(workspaceId, { outcome, completedAt });
    this.writes++;
  }
}
