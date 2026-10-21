import { test } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { createMonitorRunner } from "./monitor-runner";
import { createAuthenticatedSchedulerHandler } from "./guard-scheduler";

const secret = "unit-test-scheduler-secret";
function invoke(handler: ReturnType<typeof createAuthenticatedSchedulerHandler>, authorization?: string) {
  let status = 0;
  const req = { get: (key: string) => key.toLowerCase() === "authorization" ? authorization : undefined } as unknown as Request;
  const res = { sendStatus: (value: number) => { status = value; return res; } } as unknown as Response;
  return handler(req, res).then(() => status);
}

test("authenticated scheduler rejects missing and invalid bearer tokens without running", async () => {
  let runs = 0;
  const handler = createAuthenticatedSchedulerHandler(async () => { runs++; return true; }, () => secret);
  assert.equal(await invoke(handler), 403);
  assert.equal(await invoke(handler, "Bearer wrong"), 403);
  assert.equal(runs, 0);
  assert.equal(await invoke(handler, `Bearer ${secret}`), 204);
  assert.equal(runs, 1);
});

test("scheduler fails closed when no authentication secret is configured", async () => {
  const handler = createAuthenticatedSchedulerHandler(async () => true, () => undefined);
  assert.equal(await invoke(handler, `Bearer ${secret}`), 503);
});

test("overlapping authenticated runs return 409 while only one monitor is active", async () => {
  let release!: () => void;
  let entered!: () => void;
  let count = 0;
  const enteredPromise = new Promise<void>(resolve => { entered = resolve; });
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const runner = createMonitorRunner(async () => {
    count++;
    entered();
    await blocked;
  });
  const handler = createAuthenticatedSchedulerHandler(runner, () => secret);
  const first = invoke(handler, `Bearer ${secret}`);
  await enteredPromise;
  assert.equal(await invoke(handler, `Bearer ${secret}`), 409);
  assert.equal(count, 1);
  release();
  assert.equal(await first, 204);
  assert.equal(count, 1);
});

test("monitor lock releases after a failed run so the next tick can retry", async () => {
  let attempts = 0;
  const runner = createMonitorRunner(async () => {
    attempts++;
    if (attempts === 1) throw new Error("synthetic failure");
  });
  await assert.rejects(runner());
  assert.equal(await runner(), true);
  assert.equal(attempts, 2);
});
