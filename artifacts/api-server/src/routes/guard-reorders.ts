import { Router } from "express";
import { ConfigureReorderBody, DecideReorderBody, GetReordersResponse } from "@workspace/api-zod";
import { changeWorkspace } from "../lib/guard-store";
import { configFor, decideReorder, reorderState, scanReorders, type Reorders } from "../lib/guard-reorder";
import { InputError } from "../lib/guard-follow-ups";
import { runWorkflows } from "../lib/guard-automation";

const router = Router();
router.get("/guard/reorders", async (_req, res) => {
  let result: Reorders | undefined;
  await changeWorkspace(s => { runWorkflows(s); result = reorderState(s); }, false);
  res.json(GetReordersResponse.parse(result));
});
router.post("/guard/reorders/scan", async (_req, res) => {
  let result: Reorders | undefined;
  await changeWorkspace(s => { scanReorders(s); result = reorderState(s); }, false);
  res.json(GetReordersResponse.parse(result));
});
router.patch("/guard/reorders/settings", async (req, res) => {
  const body = ConfigureReorderBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid supplier assumptions. Check numeric ranges." }); return; }
  let result: Reorders | undefined;
  try {
    await changeWorkspace(s => {
      if (!s.ingredients.some(i => i.id === body.data.ingredientId)) throw new InputError("Unknown ingredient.");
      s.reordering ??= { settings: [], plans: [] };
      const previous = configFor(s, body.data.ingredientId);
      s.reordering.settings = [...s.reordering.settings.filter(c => c.ingredientId !== body.data.ingredientId), body.data];
      s.activity.unshift({ id: crypto.randomUUID(), time: new Date().toISOString(), title: "Reordering assumptions updated", detail: `${body.data.ingredientId}: ${JSON.stringify(previous)} → ${JSON.stringify(body.data)}. Owner-entered estimates, not verified supplier data. No order changed.`, decision: "input", impact: 0 });
      scanReorders(s); result = reorderState(s);
    }, false);
    res.json(GetReordersResponse.parse(result));
  } catch (e) { if (e instanceof InputError) { res.status(400).json({ error: e.message }); return; } throw e; }
});
router.post("/guard/reorders/:id/decision", async (req, res) => {
  const body = DecideReorderBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Enter a valid decision, owner name and quantity." }); return; }
  let result: Reorders | undefined;
  try {
    await changeWorkspace(s => { decideReorder(s, req.params.id, body.data); result = reorderState(s); }, false);
    res.json(GetReordersResponse.parse(result));
  } catch (e) { if (e instanceof InputError) { res.status(400).json({ error: e.message }); return; } throw e; }
});
export default router;
