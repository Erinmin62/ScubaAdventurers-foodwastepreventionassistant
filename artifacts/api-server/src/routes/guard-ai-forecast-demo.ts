import { Router, type IRouter } from "express";
import { GenerateAiDemoForecastBody } from "@workspace/api-zod";
import { currentWorkspaceId } from "../lib/workspace-context";
import {
  AiForecastDemoError,
  buildSyntheticForecastContext,
  completeSyntheticForecast,
  parseSyntheticForecastOutput,
  type SyntheticForecastContext,
} from "../lib/ai-forecast-demo";

const REQUEST_LIMIT = 3;
const WINDOW_MS = 60 * 60 * 1000;
const requestsByWorkspace = new Map<string, number[]>();
type ForecastRunner = (context: SyntheticForecastContext) => Promise<string>;

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

export function createGuardAiForecastDemoRouter(runModel: ForecastRunner = completeSyntheticForecast): IRouter {
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
  return router;
}

const router = createGuardAiForecastDemoRouter();
export default router;
