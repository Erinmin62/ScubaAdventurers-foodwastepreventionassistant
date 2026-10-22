import { Router, type IRouter, type Request } from "express";
import { getAuth } from "@clerk/express";
import {
  ConfirmIngredientPhotoUploadBody,
  RequestIngredientPhotoUploadBody,
  RequestIngredientPhotoUploadResponse,
} from "@workspace/api-zod";
import { changeWorkspace, readWorkspace } from "../lib/guard-store";
import {
  ingredientPhotoObjectKey,
  isIngredientPhotoObjectKeyForOwner,
  inspectIngredientPhoto,
  signIngredientPhotoUrl,
  type PhotoHttpMethod,
} from "../lib/ingredient-photo-storage";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type PhotoInspection = { exists: boolean; size: number; contentType: string };
type Dependencies = {
  identity: (req: Request) => string | null;
  sign: (key: string, method: PhotoHttpMethod) => Promise<string>;
  inspect: (key: string) => Promise<PhotoInspection>;
};

const defaultDependencies: Dependencies = {
  identity: req => getAuth(req).userId,
  sign: signIngredientPhotoUrl,
  inspect: inspectIngredientPhoto,
};

export function createIngredientPhotoRouter(dependencies = defaultDependencies): IRouter {
  const router: IRouter = Router();

  router.post("/uploads/request-url", async (req, res): Promise<void> => {
    const ownerId = dependencies.identity(req);
    if (!ownerId) { res.status(401).json({ error: "Sign in to upload ingredient photos." }); return; }
    const parsed = RequestIngredientPhotoUploadBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Choose a JPEG, PNG, or WebP image smaller than 5 MB." }); return; }
    const { ingredientId, size, contentType } = parsed.data;
    if (!ALLOWED_IMAGE_TYPES.has(contentType) || size > MAX_IMAGE_BYTES) {
      res.status(400).json({ error: "Choose a JPEG, PNG, or WebP image smaller than 5 MB." });
      return;
    }

    const workspace = await readWorkspace();
    if (!workspace?.ingredients.some(ingredient => ingredient.id === ingredientId)) {
      res.status(404).json({ error: "Ingredient not found in your café workspace." });
      return;
    }

    try {
      const objectKey = ingredientPhotoObjectKey(ownerId, ingredientId);
      const uploadURL = await dependencies.sign(objectKey, "PUT");
      res.json(RequestIngredientPhotoUploadResponse.parse({ uploadURL, objectKey }));
    } catch (error) {
      req.log?.error({ err: error }, "Could not create ingredient photo upload URL");
      res.status(503).json({ error: "Photo storage is temporarily unavailable. Try again." });
    }
  });

  router.post("/uploads/confirm", async (req, res): Promise<void> => {
    const ownerId = dependencies.identity(req);
    if (!ownerId) { res.status(401).json({ error: "Sign in to save ingredient photos." }); return; }
    const parsed = ConfirmIngredientPhotoUploadBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "The uploaded photo reference is invalid." }); return; }
    const { ingredientId, objectKey } = parsed.data;
    if (!isIngredientPhotoObjectKeyForOwner(objectKey, ownerId, ingredientId)) {
      res.status(404).json({ error: "Photo not found for this café account." });
      return;
    }
    const workspace = await readWorkspace();
    if (!workspace?.ingredients.some(ingredient => ingredient.id === ingredientId)) {
      res.status(404).json({ error: "Ingredient not found in your café workspace." });
      return;
    }

    try {
      const stored = await dependencies.inspect(objectKey);
      if (!stored.exists || stored.size < 1 || stored.size > MAX_IMAGE_BYTES || !ALLOWED_IMAGE_TYPES.has(stored.contentType)) {
        res.status(400).json({ error: "Upload a valid JPEG, PNG, or WebP image smaller than 5 MB." });
        return;
      }
      res.json(await changeWorkspace(state => {
        const ingredient = state.ingredients.find(item => item.id === ingredientId);
        if (!ingredient) throw new Error("Ingredient no longer exists.");
        ingredient.photoPath = objectKey;
      }));
    } catch (error) {
      req.log?.error({ err: error }, "Could not confirm ingredient photo");
      res.status(503).json({ error: "Could not save the photo. Try again." });
    }
  });

  router.get("/objects/:objectKey", async (req, res): Promise<void> => {
    const ownerId = dependencies.identity(req);
    if (!ownerId) { res.status(401).json({ error: "Sign in to view ingredient photos." }); return; }
    const objectKey = req.params.objectKey;
    if (typeof objectKey !== "string" || !/^[a-f0-9]{96}$/.test(objectKey)) {
      res.status(404).json({ error: "Photo not found." });
      return;
    }
    const workspace = await readWorkspace();
    if (!workspace?.ingredients.some(ingredient => ingredient.photoPath === objectKey)) {
      res.status(404).json({ error: "Photo not found for this café account." });
      return;
    }
    try {
      const url = await dependencies.sign(objectKey, "GET");
      res.setHeader("Cache-Control", "private, no-store");
      res.redirect(302, url);
    } catch (error) {
      req.log?.error({ err: error }, "Could not create private ingredient photo URL");
      res.status(503).json({ error: "Photo storage is temporarily unavailable. Try again." });
    }
  });

  return router;
}

