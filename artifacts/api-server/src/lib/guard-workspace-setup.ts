import type { WorkspaceSetupInput } from "@workspace/api-zod";
import { InputError } from "./guard-follow-ups";
import type { Stored } from "./guard-model";

export function chooseWorkspaceMode(s: Stored, input: WorkspaceSetupInput) {
  if (s.workspaceMode === "owner_data") {
    if (input.mode === "synthetic_demo") {
      throw new InputError("An owner-data workspace cannot be switched back to synthetic demo mode.");
    }
    return;
  }

  if (input.mode === "synthetic_demo") {
    if (s.workspaceMode !== "synthetic_demo") {
      s.workspaceMode = "synthetic_demo";
      s.activity.unshift({
        id: crypto.randomUUID(),
        time: new Date().toISOString(),
        title: "Synthetic demo workspace selected",
        detail: "The sample menu, pantry, sales and waste records are illustrative only. No real orders are placed.",
        decision: "system",
        impact: 0,
      });
    }
    return;
  }

  if (input.confirmReplaceSamples !== true) {
    throw new InputError("Confirm that you want to replace the current sample menu, pantry, sales and waste records.");
  }

  s.workspaceMode = "owner_data";
  s.ingredients = [];
  s.menu = [];
  s.sales = [];
  s.results = [];
  s.decisions = {};
  s.followUps = [];
  s.baseline = { wasteCost: 0, wasteKg: 0 };
  s.menuRevision = (s.menuRevision ?? 0) + 1;
  s.automationProgress = {};
  s.reordering = { settings: [], plans: [] };
  if (s.automation) s.automation.runs = [];
  if (s.notifications) s.notifications.events = {};
  const thresholds = s.inbox?.thresholds ?? { warningDays: 3, upcomingDays: 7 };
  s.inbox = { items: [], thresholds, checkedAt: "" };
  s.activity = s.activity.filter(event => event.decision !== "automation");
  s.activity.unshift({
    id: crypto.randomUUID(),
    time: new Date().toISOString(),
    title: "Owner-data workspace started",
    detail: "Demo menu, pantry, sales, waste results, decisions and planning snapshots were cleared. Imported historical archive records remain separate and unchanged.",
    decision: "system",
    impact: 0,
  });
}
