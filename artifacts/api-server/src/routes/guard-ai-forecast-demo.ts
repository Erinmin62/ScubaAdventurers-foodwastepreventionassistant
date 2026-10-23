import { Router, type IRouter } from "express";
import { GenerateAiDemoForecastBody, GenerateAiOwnerHistoryForecastBody } from "@workspace/api-zod";
import { currentWorkspaceId } from "../lib/workspace-context";
import { readWorkspace } from "../lib/guard-store";
import {
  AiForecastDemoError,
  buildOwnerHistoryForecastContext,
  buildSyntheticForecastContext,
  completeOwnerHistoryForecast,
  completeSyntheticForecast,
  parseOwnerHistoryForecastOutput,
  parseSyntheticForecastOutput,
  type OwnerHistoryForecastContext,
  type SyntheticForecastContext,
} from "../lib/ai-forecast-demo";

const REQUEST_LIMIT = 3;
const WINDOW_MS = 60 * 60 * 1000;
const requestsByWorkspace = new Map<string, number[]>();
const ownerHistoryRequestsByWorkspace = new Map<string, number[]>();
type ForecastRunner = (context: SyntheticForecastContext) => Promise<string>;
type OwnerHistoryForecastRunner = (context: OwnerHistoryForecastContext) => Promise<string>;

function workspaceKey() {
  try { return currentWorkspaceId(); } catch { return "test-workspace"; }
}

function useForecastAllowance(key: string) {
  const now = Date.now();
  const recent = (requestsByWorkspace.get(key) ?? []).filter(timestamp => now - timestamp < WINDOW_MS);
  if (recent.length >= REQUEST_LIMIT) {
    requestsByWorkspace.set(key, recent);
    return false;
  }
  recent.push(now);
  requestsByWorkspace.set(key, recent);
  return true;
}

function useOwnerHistoryForecastAllowance(key: string) {
  const now = Date.now();
  const recent = (ownerHistoryRequestsByWorkspace.get(key) ?? []).filter(timestamp => now - timestamp < WINDOW_MS);
  if (recent.length >= REQUEST_LIMIT) {
    ownerHistoryRequestsByWorkspace.set(key, recent);
    return false;
  }
  recent.push(now);
  ownerHistoryRequestsByWorkspace.set(key, recent);
  return true;
}

export function createGuardAiForecastDemoRouter(
  runModel: ForecastRunner = completeSyntheticForecast,
  runOwnerHistoryModel: OwnerHistoryForecastRunner = completeOwnerHistoryForecast,
): IRouter {
  const router: IRouter = Router();
  router.post("/guard/ai-forecast/demo", async (req, res): Promise<void> => {
    const parsed = GenerateAiDemoForecastBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Confirm that this is a synthetic demonstration." });
      return;
    }
    const owner = workspaceKey();
    if (!useForecastAllowance(owner)) {
      res.status(429).json({ error: "The AI demo is limited to three runs per workspace each hour." });
      return;
    }
    const context = buildSyntheticForecastContext();
    try {
      const modelOutput = await runModel(context);
      res.json(parseSyntheticForecastOutput(modelOutput, context));
    } catch (error) {
      req.log?.warn(
        { error: error instanceof AiForecastDemoError ? error.message : "AI demo provider failed" },
        "Synthetic AI forecast demonstration could not be generated",
      );
      res.status(503).json({ error: "The AI demo could not generate a valid forecast. Existing planning and stock were not changed." });
    }
  });
  router.post("/guard/ai-forecast/owner-history", async (req, res): Promise<void> => {
    const parsed = GenerateAiOwnerHistoryForecastBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Explicitly confirm the displayed owner-history preview before requesting a forecast." });
      return;
    }
    const owner = workspaceKey();
    const stored = await readWorkspace();
    const context = buildOwnerHistoryForecastContext(stored?.historicalRecords);
    if (!context) {
      res.status(400).json({ error: "No usable archived sales or preparation history is available for forecasting." });
      return;
    }
    if (
      parsed.data.expectedHistoryStart.toISOString().slice(0, 10) !== context.historyStart ||
      parsed.data.expectedHistoryEnd.toISOString().slice(0, 10) !== context.historyEnd ||
      parsed.data.expectedSalesCount !== context.salesCount ||
      parsed.data.expectedPreparationCount !== context.preparationCount
    ) {
      res.status(409).json({ error: "The archive changed after you reviewed it. Refresh the preview and confirm again." });
      return;
    }
    if (!useOwnerHistoryForecastAllowance(owner)) {
      res.status(429).json({ error: "The owner-history AI forecast is limited to three runs per workspace each hour." });
      return;
    }
    try {
      const modelOutput = await runOwnerHistoryModel(context);
      res.json(parseOwnerHistoryForecastOutput(modelOutput, context));
    } catch (error) {
      req.log?.warn(
        { error: error instanceof AiForecastDemoError ? error.message : "AI forecast provider failed" },
        "Owner-history AI forecast could not be generated",
      );
      res.status(503).json({ error: "The owner-history forecast could not generate a valid result. Your archive and operational workspace were not changed." });
    }
  });
  return router;
}

const router = createGuardAiForecastDemoRouter();
export default router;
