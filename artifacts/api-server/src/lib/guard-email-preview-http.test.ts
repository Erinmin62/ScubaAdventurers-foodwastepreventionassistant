import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Server } from "node:http";
import { createOwnerAuth } from "../middlewares/owner-auth";
import { createGuardEmailPreviewRouter } from "../routes/guard-email-preview";
import { currentWorkspaceId, ownerWorkspaceId } from "./workspace-context";
import { seed, type Stored } from "./guard-model";

let server: Server;
let base: string;
let reads = 0;
let workspaceIds: string[] = [];
let workspace: Stored;

before(async () => {
  workspace = seed();
  const app = express();
  app.use("/api/guard", createOwnerAuth(req => req.get("x-test-user") ?? null));
  app.use("/api", createGuardEmailPreviewRouter(async () => {
    reads++;
    workspaceIds.push(currentWorkspaceId());
    return workspace;
  }));
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  base = `http://127.0.0.1:${address.port}`;
});

after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

test("email preview requires owner identity, ignores caller workspace IDs, and only reads that workspace", async () => {
  const before = structuredClone(workspace);
  const url = `${base}/api/guard/email-preview?workspaceId=owner:other`;
  assert.equal((await fetch(url)).status, 401);
  assert.equal(reads, 0);

  const response = await fetch(url, { headers: { "x-test-user": "alice", "x-workspace-id": "owner:other" } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const preview = await response.json() as {
    workspaceName: string;
    synthetic: boolean;
    timeZone: string;
    urgentAlerts: { kind: string; subject: string }[];
    digest: { kind: string; subject: string }[];
  };
  assert.equal(preview.workspaceName, "Little Leaf Café");
  assert.equal(preview.synthetic, true);
  assert.equal(preview.timeZone, "Asia/Kuala_Lumpur");
  assert.ok(preview.urgentAlerts.length > 0);
  assert.ok(preview.urgentAlerts.every(item => item.kind === "critical_expiry"));
  assert.ok(preview.digest.every(item => item.kind === "daily_digest"));
  assert.deepEqual(workspaceIds, [ownerWorkspaceId("alice")]);
  assert.equal(reads, 1);
  assert.deepEqual(workspace, before);
  assert.equal("workspaceId" in preview, false);
});
