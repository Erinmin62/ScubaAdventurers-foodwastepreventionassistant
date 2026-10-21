// Used only by the HTTP test bundler, which substitutes this for guard-store.
// Never connects to the shared demo database. Clone/commit + a queue model the
// store's transaction boundary; PostgreSQL locking is not tested by this fixture.
import { compute, seed, type Stored } from "./guard-model";
import { runWorkflows } from "./guard-automation";
import { GetGuardStateResponse } from "@workspace/api-zod";
import { scanNotificationEvents } from "./guard-notifications";
import { migrateBatches } from "./guard-batches";
import { syncInbox } from "./guard-inbox";
import { currentWorkspaceId } from "./workspace-context";

const saved = new Map<string, Stored>();
function workspace() {
  try { return currentWorkspaceId(); }
  catch { return "demo"; } // Existing pure route tests deliberately omit auth.
}
let tail: Promise<unknown> = Promise.resolve();
export function resetWorkspace(state: Stored, id = workspace()) { saved.set(id, structuredClone(state)); }
export function snapshotWorkspace(id = workspace()) { return structuredClone(saved.get(id) ?? seed()); }
export function readWorkspace() { return snapshotWorkspace(); }
export function changeWorkspace(action: (s: Stored) => void = () => {}, autoRun = true) {
  const id = workspace();
  const work = tail.then(() => {
    const staged = snapshotWorkspace(id);
    migrateBatches(staged);
    action(staged);
    if (autoRun) runWorkflows(staged);
    scanNotificationEvents(staged);
    syncInbox(staged);
    const response = GetGuardStateResponse.parse(compute(staged));
    saved.set(id, staged);
    return response;
  });
  tail = work.catch(() => {});
  return work;
}
