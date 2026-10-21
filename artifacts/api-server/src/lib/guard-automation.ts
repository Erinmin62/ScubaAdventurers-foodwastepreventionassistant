import { compute, today, type Stored, type State } from "./guard-model";
import { InputError } from "./guard-follow-ups";
import { scanReorders } from "./guard-reorder";

type Workflow = State["automation"]["runs"][number]["workflow"];

export function runWorkflows(s: Stored, request?: Workflow | "all") {
  s.automation ??= { dailyPlanning: true, followUpHandling: true, runs: [] };
  s.automationProgress ??= {};
  const a = s.automation, progress = s.automationProgress, d = today();
  if (request === "daily-planning" && !a.dailyPlanning || request === "follow-ups" && !a.followUpHandling || request === "all" && !a.dailyPlanning && !a.followUpHandling) {
    throw new InputError("Enable the selected workflow before running it.");
  }
  const state = compute(s);
  const outstanding = (s.followUps ?? []).filter(f => f.status === "outstanding");
  const due = outstanding.filter(f => f.scheduledDate === d);
  const overdue = outstanding.filter(f => f.scheduledDate < d);
  const needingReminder = [...due, ...overdue].some(f => progress.reminded?.[f.id] !== d);
  const addRun = (workflow: Workflow, detail: string) => {
    const run: State["automation"]["runs"][number] = {
      id: crypto.randomUUID(), workflow, trigger: request ? "manual" : "automatic", time: new Date().toISOString(), date: d, detail,
      draftCount: state.recommendations.filter(r => r.status === "pending").length,
      riskCount: state.risks.filter(r => r.level !== "low").length,
      dueCount: due.length, overdueCount: overdue.length, predictedPortions: state.summary.predictedPortions,
    };
    a.runs.unshift(run);
    a.runs = a.runs.slice(0, 30);
    s.activity.unshift({ id: run.id, time: run.time, title: workflow === "daily-planning" ? "Automation: daily planning ready" : "Automation: follow-up check", detail, decision: "automation", impact: 0 });
  };
  if (a.dailyPlanning && (request === "daily-planning" || request === "all" || !request && (progress.dailyDate !== d || !s.reordering))) {
    scanReorders(s);
    addRun("daily-planning", `Refreshed tomorrow's forecast: ${state.summary.predictedPortions} portions. ${state.recommendations.filter(r => r.status === "pending").length} draft recommendations await your decision; ${state.risks.filter(r => r.level !== "low").length} ingredients need expiry review. Expired ingredients excluded from preparation. This is a saved review snapshot; live recommendations continue to reflect current data. No plans approved and no orders placed.`);
    progress.dailyDate = d;
  }
  if (a.followUpHandling && (request === "follow-ups" || request === "all" || !request && (progress.followUpDate !== d || needingReminder))) {
    const names = [...due, ...overdue].slice(0, 5).map(f => f.name).join(", ");
    addRun("follow-ups", `Checked ${outstanding.length} outstanding follow-ups: ${due.length} due today, ${overdue.length} overdue.${names ? ` Needs your stock observation: ${names}.` : " No observation reminders due."} Due checks appear in Today → Result checks. New approvals automatically schedule their selected 1–2-day check. Outcomes are evaluated only after you enter actual quantities; no stock or waste records invented.`);
    progress.followUpDate = d;
    progress.reminded = Object.fromEntries([...due, ...overdue].map(f => [f.id, d]));
  }
}
