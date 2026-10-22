import { Router, type IRouter, type Request } from "express";
import { getAuth } from "@clerk/express";
import {
  ConfirmIngredientPhotoUploadBody,
  RemoveIngredientPhotoParams,
  RequestIngredientPhotoUploadBody,
  RequestIngredientPhotoUploadResponse,
} from "@workspace/api-zod";
import { changeWorkspace, readWorkspace } from "../lib/guard-store";
import {
  ingredientPhotoObjectKey,
  isIngredientPhotoObjectKeyForOwner,
  inspectIngredientPhoto,
  deleteIngredientPhoto,
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
  remove: (key: string) => Promise<void>;
};

const defaultDependencies: Dependencies = {
  identity: req => getAuth(req).userId,
  sign: signIngredientPhotoUrl,
  inspect: inspectIngredientPhoto,
  remove: deleteIngredientPhoto,
};

export function createIngredientPhotoRouter(dependencies = defaultDependencies): IRouter {
  const router: IRouter = Router();

  const removeIfUnreferenced = async (
    req: Request,
    ownerId: string,
    ingredientId: string,
    objectKey: string,
  ): Promise<void> => {
    if (!isIngredientPhotoObjectKeyForOwner(objectKey, ownerId, ingredientId)) return;
    try {
      const workspace = await readWorkspace();
      // Do not delete when state cannot be checked, or another ingredient still references it.
      if (!workspace || workspace.ingredients.some(ingredient => ingredient.photoPath === objectKey)) return;
      await dependencies.remove(objectKey);
    } catch (error) {
      // The database already points at the valid new/default image. A cleanup failure
      // leaves an orphan but must not turn a successful image change into a failure.
      req.log?.warn({ err: error, ingredientId }, "Could not clean up an old ingredient photo");
    }
  };

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
      res.status(404).json({ error: "Ingredient not found in your business workspace." });
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
      res.status(404).json({ error: "Photo not found in this business workspace." });
      return;
    }
    const workspace = await readWorkspace();
    if (!workspace?.ingredients.some(ingredient => ingredient.id === ingredientId)) {
      res.status(404).json({ error: "Ingredient not found in your business workspace." });
      return;
    }

    try {
      const stored = await dependencies.inspect(objectKey);
      if (!stored.exists || stored.size < 1 || stored.size > MAX_IMAGE_BYTES || !ALLOWED_IMAGE_TYPES.has(stored.contentType)) {
        res.status(400).json({ error: "Upload a valid JPEG, PNG, or WebP image smaller than 5 MB." });
        return;
      }
      let previousPhotoKey: string | undefined;
      const state = await changeWorkspace(state => {
        const ingredient = state.ingredients.find(item => item.id === ingredientId);
        if (!ingredient) throw new Error("Ingredient no longer exists.");
        if (typeof ingredient.photoPath === "string" &&
          isIngredientPhotoObjectKeyForOwner(ingredient.photoPath, ownerId, ingredientId)) {
          previousPhotoKey = ingredient.photoPath;
        }
        ingredient.photoPath = objectKey;
      });
      if (previousPhotoKey && previousPhotoKey !== objectKey) {
        await removeIfUnreferenced(req, ownerId, ingredientId, previousPhotoKey);
      }
      res.json(state);
    } catch (error) {
      req.log?.error({ err: error }, "Could not confirm ingredient photo");
      res.status(503).json({ error: "Could not save the photo. Try again." });
    }
  });

  router.delete("/ingredients/:ingredientId/photo", async (req, res): Promise<void> => {
    const ownerId = dependencies.identity(req);
    if (!ownerId) { res.status(401).json({ error: "Sign in to remove ingredient photos." }); return; }
    const parsed = RemoveIngredientPhotoParams.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "The ingredient reference is invalid." }); return; }
    const { ingredientId } = parsed.data;
    const workspace = await readWorkspace();
    if (!workspace?.ingredients.some(ingredient => ingredient.id === ingredientId)) {
      res.status(404).json({ error: "Ingredient not found in your business workspace." });
      return;
    }

    let previousPhotoKey: string | undefined;
    try {
      const state = await changeWorkspace(stored => {
        const ingredient = stored.ingredients.find(item => item.id === ingredientId);
        if (!ingredient) throw new Error("Ingredient no longer exists.");
        if (typeof ingredient.photoPath === "string" &&
          isIngredientPhotoObjectKeyForOwner(ingredient.photoPath, ownerId, ingredientId)) {
          previousPhotoKey = ingredient.photoPath;
        }
        delete ingredient.photoPath;
      });
      if (previousPhotoKey) {
        await removeIfUnreferenced(req, ownerId, ingredientId, previousPhotoKey);
      }
      res.json(state);
    } catch (error) {
      req.log?.error({ err: error, ingredientId }, "Could not remove ingredient photo");
      res.status(503).json({ error: "Could not remove the photo. Try again." });
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
      res.status(404).json({ error: "Photo not found in this business workspace." });
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

