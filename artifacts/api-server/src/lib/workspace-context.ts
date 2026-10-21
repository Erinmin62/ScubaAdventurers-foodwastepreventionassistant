import { AsyncLocalStorage } from "node:async_hooks";

// Only verified authentication middleware and trusted background jobs set this.
// Never accept a workspace identifier from a URL, header or request body.
const context = new AsyncLocalStorage<string>();
export const LEGACY_DEMO_WORKSPACE = "demo";
export const ownerWorkspaceId = (userId: string) => `owner:${userId}`;
export function inWorkspace<T>(id: string, work: () => T): T {
  return context.run(id, work);
}
export function currentWorkspaceId() {
  const id = context.getStore();
  if (!id) throw new Error("An authenticated workspace context is required.");
  return id;
}
