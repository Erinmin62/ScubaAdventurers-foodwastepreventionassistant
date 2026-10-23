import { createHash, randomUUID } from "node:crypto";

const STORAGE_SIDECAR = "http://127.0.0.1:1106";
const PRIVATE_OBJECT_PREFIX = "ingredient-photos";

export type PhotoHttpMethod = "PUT" | "GET" | "HEAD" | "DELETE";

function ingredientPhotoOwnerPrefix(ownerId: string, ingredientId: string): string {
  return createHash("sha256").update(`${ownerId}\0${ingredientId}`).digest("hex");
}

export function ingredientPhotoObjectKey(ownerId: string, ingredientId: string): string {
  return `${ingredientPhotoOwnerPrefix(ownerId, ingredientId)}${randomUUID().replaceAll("-", "")}`;
}

export function isIngredientPhotoObjectKeyForOwner(
  objectKey: string,
  ownerId: string,
  ingredientId: string,
): boolean {
  return /^[a-f0-9]{96}$/.test(objectKey) &&
    objectKey.startsWith(ingredientPhotoOwnerPrefix(ownerId, ingredientId));
}

function objectLocation(objectKey: string) {
  if (!/^[a-f0-9]{96}$/.test(objectKey)) {
    throw new Error("Invalid private photo reference.");
  }
  const configuredDir = process.env.PRIVATE_OBJECT_DIR;
  if (!configuredDir) throw new Error("Private object storage is not configured.");

  // PRIVATE_OBJECT_DIR is a GCS path in the form /bucket-name/optional/prefix.
  const [bucketName, ...directoryParts] = configuredDir.split("/").filter(Boolean);
  if (!bucketName) throw new Error("Private object storage is not configured.");
  return {
    bucketName,
    objectName: [...directoryParts, PRIVATE_OBJECT_PREFIX, objectKey].join("/"),
  };
}

export async function signIngredientPhotoUrl(
  objectKey: string,
  method: PhotoHttpMethod,
): Promise<string> {
  const { bucketName, objectName } = objectLocation(objectKey);
  const response = await fetch(`${STORAGE_SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("Could not create a private photo URL.");
  const result = await response.json() as { signed_url?: unknown };
  if (typeof result.signed_url !== "string" || !result.signed_url.startsWith("https://")) {
    throw new Error("Storage did not return a valid upload URL.");
  }
  return result.signed_url;
}

export async function inspectIngredientPhoto(objectKey: string) {
  const url = await signIngredientPhotoUrl(objectKey, "HEAD");
  const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(30_000) });
  return {
    exists: response.ok,
    size: Number(response.headers.get("content-length") ?? 0),
    contentType: (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase(),
  };
}

export async function deleteIngredientPhoto(objectKey: string): Promise<void> {
  const url = await signIngredientPhotoUrl(objectKey, "DELETE");
  const response = await fetch(url, { method: "DELETE", signal: AbortSignal.timeout(30_000) });
  // Treat an already-missing object as cleaned up; it cannot be restored by retrying.
  if (!response.ok && response.status !== 404) {
    throw new Error("Could not delete the private ingredient photo.");
  }
}
