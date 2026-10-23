import { Router, type IRouter } from "express";
import { CreateMenuItemBody, DraftMenuRecipeBody, ImportMenuCsvBody, ImportMenuCsvResponse, PreviewMenuImportBody, PreviewMenuImportResponse, UpdateMenuItemBody } from "@workspace/api-zod";
import { z } from "zod";
import { currentWorkspaceId } from "../lib/workspace-context";
import { changeWorkspace as change, readWorkspace } from "../lib/guard-store";
import { InputError } from "../lib/guard-follow-ups";
import { createMenuItem, deleteMenuItem, importMenuCsv, previewMenuCsv, updateMenuItem } from "../lib/guard-menu";
import { generateRecipeDraft, RecipeDraftError, type PantryOption } from "../lib/menu-recipe-ai";

const DRAFT_LIMIT = 10;
const DRAFT_WINDOW_MS = 60 * 60 * 1000;
const draftCalls = new Map<string, number[]>();
type DraftFn = (name: string, description: string, pantry: PantryOption[]) => Promise<{ recipe: { ingredientId: string; amount: number }[]; explanation: string }>;
const draftOutputSchema = z.object({
  recipe: z.array(z.object({ ingredientId: z.string().min(1), amount: z.number().finite().positive().max(1_000_000) })).min(1).max(50),
  explanation: z.string().trim().min(1).max(500),
});

function ownerKey() {
  try { return currentWorkspaceId(); } catch { return "test-workspace"; }
}
function allowedDraft(key: string) {
  const now = Date.now();
  const recent = (draftCalls.get(key) ?? []).filter(at => now - at < DRAFT_WINDOW_MS);
  if (recent.length >= DRAFT_LIMIT) {
    draftCalls.set(key, recent);
    return false;
  }
  recent.push(now);
  draftCalls.set(key, recent);
  return true;
}

export function createGuardMenuRouter(draftFn: DraftFn = generateRecipeDraft): IRouter {
  const router: IRouter = Router();

  router.post("/guard/menu/recipe-draft", async (req, res): Promise<void> => {
    const parsed = DraftMenuRecipeBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Provide a dish name and short description." }); return; }
    const workspace = await readWorkspace();
    if (!workspace || !workspace.ingredients?.length) { res.status(400).json({ error: "Add ingredients to the pantry before drafting a recipe." }); return; }
    const key = ownerKey();
    if (!allowedDraft(key)) { res.status(429).json({ error: "Recipe drafting is limited to 10 requests per workspace each hour." }); return; }
    const pantry: PantryOption[] = workspace.ingredients.map(i => ({ id: i.id, name: i.name, unit: i.unit }));
    try {
      const draft = draftOutputSchema.safeParse(await draftFn(parsed.data.name, parsed.data.description, pantry));
      if (!draft.success) {
        res.status(503).json({ error: "The recipe service returned an invalid draft. You can still build the recipe manually." });
        return;
      }
      const allowedIds = new Set(pantry.map(i => i.id));
      const recipeIds = new Set<string>();
      if (draft.data.recipe.some(r => {
        if (!allowedIds.has(r.ingredientId) || recipeIds.has(r.ingredientId)) return true;
        recipeIds.add(r.ingredientId);
        return false;
      })) {
        res.status(503).json({ error: "The recipe service returned an invalid draft. You can still build the recipe manually." });
        return;
      }
      res.json({
        recipe: draft.data.recipe,
        explanation: draft.data.explanation,
        notice: "Draft only. Verify every quantity, allergen and food-safety detail before saving.",
      });
    } catch (error) {
      const message = error instanceof RecipeDraftError ? error.message : "Recipe drafting is temporarily unavailable. You can still build the recipe manually.";
      res.status(503).json({ error: message });
    }
  });

  router.post("/guard/menu", async (req, res): Promise<void> => {
    const parsed = CreateMenuItemBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Provide valid dish details and a recipe." }); return; }
    try {
      const state = await change(s => createMenuItem(s, parsed.data));
      res.status(201).json(state);
    } catch (error) {
      if (error instanceof InputError) { res.status(400).json({ error: error.message }); return; }
      throw error;
    }
  });

  router.post("/guard/menu/import/preview", async (req, res): Promise<void> => {
    const parsed = PreviewMenuImportBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Provide CSV text of 2 MB or less." }); return; }
    const workspace = await readWorkspace();
    if (!workspace) { res.status(400).json({ error: "Set up your owner workspace before importing a menu." }); return; }
    const { parsedDishes: _parsedDishes, ...preview } = previewMenuCsv(workspace, parsed.data.csv);
    res.json(PreviewMenuImportResponse.parse({ ...preview, menuRevision: workspace.menuRevision ?? 0 }));
  });

  router.post("/guard/menu/import", async (req, res): Promise<void> => {
    const parsed = ImportMenuCsvBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Provide CSV text of 2 MB or less." }); return; }
    try {
      const state = await change(s => importMenuCsv(s, parsed.data.csv, parsed.data.expectedMenuRevision));
      res.status(201).json(ImportMenuCsvResponse.parse(state));
    } catch (error) {
      if (error instanceof InputError) { res.status(400).json({ error: error.message }); return; }
      throw error;
    }
  });

  router.patch("/guard/menu/:id", async (req, res): Promise<void> => {
    const parsed = UpdateMenuItemBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Provide valid dish details or an active status." }); return; }
    try {
      res.json(await change(s => updateMenuItem(s, req.params.id!, parsed.data)));
    } catch (error) {
      if (error instanceof InputError) { res.status(400).json({ error: error.message }); return; }
      throw error;
    }
  });

  router.delete("/guard/menu/:id", async (req, res): Promise<void> => {
    try {
      res.json(await change(s => deleteMenuItem(s, req.params.id!)));
    } catch (error) {
      if (error instanceof InputError) { res.status(404).json({ error: error.message }); return; }
      throw error;
    }
  });

  return router;
}

const router = createGuardMenuRouter();
export default router;
