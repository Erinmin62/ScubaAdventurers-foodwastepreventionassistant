// Used only by the HTTP test bundler, which substitutes this for guard-store.
// Never connects to the shared demo database. Clone/commit + a queue model the
// store's transaction boundary; PostgreSQL locking is not tested by this fixture.
import { compute, seed, type Stored } from "./guard-model";
import { runWorkflows } from "./guard-automation";
import { GetGuardStateResponse } from "@workspace/api-zod";

let saved: Stored = seed();
let tail: Promise<unknown> = Promise.resolve();
export function resetWorkspace(state: Stored) { saved = structuredClone(state); }
export function snapshotWorkspace() { return structuredClone(saved); }
export function changeWorkspace(action: (s: Stored) => void = () => {}, autoRun = true) {
  const work = tail.then(() => {
    const staged = structuredClone(saved);
    action(staged);
    if (autoRun) runWorkflows(staged);
    const response = GetGuardStateResponse.parse(compute(staged));
    saved = staged;
    return response;
  });
  tail = work.catch(() => {});
  return work;
}
