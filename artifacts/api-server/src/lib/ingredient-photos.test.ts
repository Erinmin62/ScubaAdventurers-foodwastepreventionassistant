import assert from "node:assert/strict";
import { after, test } from "node:test";
import express from "express";
import { createOwnerAuth } from "../middlewares/owner-auth";
import { createIngredientPhotoRouter } from "../routes/ingredient-photos";
import { seed } from "./guard-model";
import { resetWorkspace, snapshotWorkspace } from "./guard-http-fixture";
import { ownerWorkspaceId } from "./workspace-context";

const ownerA = "photo-owner-a";
const ownerB = "photo-owner-b";
const ingredientId = "custom-photo-ingredient";
let inspection = { exists: true, size: 1024, contentType: "image/jpeg" };
const signedCalls: { key: string; method: string }[] = [];
const sign = async (key: string, method: "PUT" | "GET" | "HEAD") => {
  signedCalls.push({ key, method });
  return `https://storage.example/${key}?method=${method}`;
};

const app = express();
app.use(express.json());
app.use(
  "/storage",
  createOwnerAuth(req => req.get("test-owner") ?? null),
  createIngredientPhotoRouter({
    identity: req => req.get("test-owner") ?? null,
    sign,
    inspect: async () => inspection,
  }),
);
const server = app.listen(0, "127.0.0.1");
const addressPromise = new Promise<string>(resolve => server.once("listening", () => {
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  resolve(`http://127.0.0.1:${address.port}`);
}));
after(() => new Promise<void>(resolve => server.close(() => resolve())));

async function call(
  path: string,
  owner?: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
) {
  const base = await addressPromise;
  return fetch(base + path, {
    method,
    headers: { ...(owner ? { "test-owner": owner } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
}

function addOwnerFixture(owner: string) {
  const state = seed();
  state.ingredients[0]!.id = ingredientId;
  state.ingredients[0]!.name = "Dragon fruit";
  resetWorkspace(state, ownerWorkspaceId(owner));
}

test("ingredient photos validate, persist, and are only served to their owner", async () => {
  addOwnerFixture(ownerA);
  addOwnerFixture(ownerB);
  inspection = { exists: true, size: 1024, contentType: "image/jpeg" };
  signedCalls.length = 0;

  assert.equal((await call("/storage/uploads/request-url", undefined, {
    ingredientId, name: "dragon-fruit.jpg", size: 1024, contentType: "image/jpeg",
  })).status, 401);
  assert.equal((await call("/storage/uploads/request-url", ownerA, {
    ingredientId, name: "dragon-fruit.svg", size: 1024, contentType: "image/svg+xml",
  })).status, 400);
  assert.equal((await call("/storage/uploads/request-url", ownerA, {
    ingredientId, name: "dragon-fruit.jpg", size: 6 * 1024 * 1024, contentType: "image/jpeg",
  })).status, 400);

  const upload = await call("/storage/uploads/request-url", ownerA, {
    ingredientId, name: "dragon-fruit.jpg", size: 1024, contentType: "image/jpeg",
  });
  assert.equal(upload.status, 200);
  const { objectKey, uploadURL } = await upload.json() as { objectKey: string; uploadURL: string };
  assert.match(objectKey, /^[a-f0-9]{96}$/);
  assert.match(uploadURL, /^https:\/\/storage\.example\//);
  assert.equal(signedCalls.at(-1)?.method, "PUT");

  assert.equal((await call("/storage/uploads/confirm", ownerB, { ingredientId, objectKey })).status, 404);
  inspection = { exists: false, size: 0, contentType: "" };
  assert.equal((await call("/storage/uploads/confirm", ownerA, { ingredientId, objectKey })).status, 400);
  assert.equal(snapshotWorkspace(ownerWorkspaceId(ownerA)).ingredients[0]!.photoPath, undefined);

  inspection = { exists: true, size: 1024, contentType: "image/jpeg" };
  assert.equal((await call("/storage/uploads/confirm", ownerA, { ingredientId, objectKey })).status, 200);
  assert.equal(snapshotWorkspace(ownerWorkspaceId(ownerA)).ingredients[0]!.photoPath, objectKey);
  assert.equal(snapshotWorkspace(ownerWorkspaceId(ownerB)).ingredients[0]!.photoPath, undefined);

  const replacement = await call("/storage/uploads/request-url", ownerA, {
    ingredientId, name: "dragon-fruit-new.jpg", size: 2048, contentType: "image/jpeg",
  });
  const { objectKey: replacementKey } = await replacement.json() as { objectKey: string };
  assert.notEqual(replacementKey, objectKey);
  inspection = { exists: false, size: 0, contentType: "" };
  assert.equal((await call("/storage/uploads/confirm", ownerA, { ingredientId, objectKey: replacementKey })).status, 400);
  assert.equal(snapshotWorkspace(ownerWorkspaceId(ownerA)).ingredients[0]!.photoPath, objectKey);
  inspection = { exists: true, size: 1024, contentType: "image/jpeg" };

  const privatePhoto = await call(`/storage/objects/${objectKey}`, ownerA);
  assert.equal(privatePhoto.status, 302);
  assert.equal(privatePhoto.headers.get("cache-control"), "private, no-store");
  assert.match(privatePhoto.headers.get("location") ?? "", /\?method=GET$/);
  assert.equal(signedCalls.at(-1)?.method, "GET");
  assert.equal((await call(`/storage/objects/${objectKey}`, ownerB)).status, 404);
  assert.equal((await call(`/storage/objects/${objectKey}`)).status, 401);
});

test("ingredient photo confirmation rejects files that are too large or not images", async () => {
  addOwnerFixture(ownerA);
  const upload = await call("/storage/uploads/request-url", ownerA, {
    ingredientId, name: "dragon-fruit.png", size: 1024, contentType: "image/png",
  });
  const { objectKey } = await upload.json() as { objectKey: string };

  inspection = { exists: true, size: 6 * 1024 * 1024, contentType: "image/png" };
  assert.equal((await call("/storage/uploads/confirm", ownerA, { ingredientId, objectKey })).status, 400);
  inspection = { exists: true, size: 1024, contentType: "text/html" };
  assert.equal((await call("/storage/uploads/confirm", ownerA, { ingredientId, objectKey })).status, 400);
  assert.equal(snapshotWorkspace(ownerWorkspaceId(ownerA)).ingredients[0]!.photoPath, undefined);
});
