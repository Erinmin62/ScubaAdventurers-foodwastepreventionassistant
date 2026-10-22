import type { EmailRoute } from "./config";
import type { EmailRecord, EmailRepository } from "./repository";
import { EMAIL_TIME_ZONE, expiryEmailCandidates, hash, scanEmailCandidates, type EmailCandidate } from "./rules";
import type { EmailSender, SendResult } from "./sender";

const DAY_MS = 24 * 60 * 60 * 1000;
type Options = {
  dryRun: boolean; routes: EmailRoute[]; sender?: EmailSender; maxPerRun?: number;
  expiryOnly?: boolean;
  clock?: () => Date; pause?: () => Promise<void>;
  log?: (event: string, fields: Record<string, unknown>) => void;
};
export function emailRecord(candidate: EmailCandidate, workspaceId: string, recipientHash: string, now: Date, scheduledAt = now.toISOString()): EmailRecord {
  return {
    ...candidate, id: hash(JSON.stringify(["email-v1", workspaceId, recipientHash, candidate.kind, candidate.eventKey])),
    workspaceId, recipientHash, scheduledAt, observedAt: now.toISOString(), status: "queued", attempts: 0,
  };
}
function reminder(candidate: EmailCandidate): EmailCandidate {
  return {
    ...candidate, kind: "approval_reminder",
    message: { subject: `Reminder: ${candidate.message.subject}`, text: `This approval is still pending at least 24 hours after the first email was accepted by the email service.\n\n${candidate.message.text}` },
  };
}

/** One finite pass. Writes only the outbox; never calls changeWorkspace or any action executor. */
export async function runEmailWorker(repository: EmailRepository, options: Options) {
  const clock = options.clock ?? (() => new Date());
  const log = options.log ?? (() => {});
  const max = options.maxPerRun ?? 100;
  const summary = {
    mode: options.dryRun ? "dry-run" : "send", timeZone: EMAIL_TIME_ZONE, workspacesChecked: 0,
    ingredientsChecked: 0, batchesChecked: 0, actionsChecked: 0, invalidRecords: 0,
    candidates: 0, wouldSend: 0, sent: 0, skipped: 0, failed: 0, uncertain: 0, cancelled: 0,
    deliveryVerified: false, overlapSkipped: false,
  };
  if (!options.dryRun && (!options.sender || !options.routes.length)) throw new Error("email_sender_or_owner_routes_missing");
  let locked = false, attempts = 0;
  const completedChecks = new Set<string>();
  try {
    if (!options.dryRun) {
      locked = await repository.lock();
      if (!locked) {
        summary.overlapSkipped = true;
        log("email_worker_overlap_skipped", summary);
        return summary;
      }
      summary.uncertain += await repository.recoverInterrupted();
    }
    const workspaces = await repository.workspaces(options.routes.length ? options.routes.map(route => route.workspaceId) : undefined);
    if (!options.dryRun && options.expiryOnly) {
      const foundWorkspaceIds = new Set(workspaces.map(workspace => workspace.id));
      for (const route of options.routes) {
        if (!foundWorkspaceIds.has(route.workspaceId)) {
          await repository.saveExpiryCheckStatus(route.workspaceId, "failed", clock().toISOString());
          completedChecks.add(route.workspaceId);
        }
      }
    }
    if (options.routes.length && workspaces.length !== options.routes.length) {
      summary.failed += options.routes.length - workspaces.length;
      log("email_worker_missing_configured_workspace", { missing: options.routes.length - workspaces.length });
    }
    for (const workspace of workspaces) {
      summary.workspacesChecked++;
      const route = options.routes.find(row => row.workspaceId === workspace.id);
      const recipientHash = route?.recipientHash ?? "dry-run-no-recipient";
      const now = clock();
      let scan: ReturnType<typeof scanEmailCandidates>;
      try {
        scan = scanEmailCandidates(workspace.data, now);
        if (options.expiryOnly) scan = { ...scan, candidates: expiryEmailCandidates(scan.candidates) };
      } catch {
        summary.failed++;
        if (!options.dryRun && options.expiryOnly) {
          await repository.saveExpiryCheckStatus(workspace.id, "failed", clock().toISOString());
          completedChecks.add(workspace.id);
        }
        log("email_worker_invalid_workspace", { workspace: hash(workspace.id).slice(0, 12) });
        continue;
      }
      if (!options.dryRun && options.expiryOnly) {
        await repository.saveExpiryCheckStatus(workspace.id, "success", clock().toISOString());
        completedChecks.add(workspace.id);
      }
      summary.ingredientsChecked += scan.ingredientsChecked;
      summary.batchesChecked += scan.batchesChecked;
      summary.actionsChecked += scan.actionsChecked;
      summary.invalidRecords += scan.invalidRecords;
      const history = new Map((await repository.records(workspace.id, recipientHash)).map(row => [row.id, row]));
      const records = scan.candidates.map(candidate => emailRecord(candidate, workspace.id, recipientHash, now));
      for (const candidate of scan.candidates.filter(row => row.kind === "approval_initial")) {
        const initial = history.get(emailRecord(candidate, workspace.id, recipientHash, now).id);
        if (initial?.status === "accepted" && initial.acceptedAt) {
          records.push(emailRecord(reminder(candidate), workspace.id, recipientHash, now,
            new Date(Date.parse(initial.acceptedAt) + DAY_MS).toISOString()));
        }
      }
      summary.candidates += records.length;
      if (!options.dryRun) {
        for (const row of records) await repository.enqueue(row);
        summary.cancelled += await repository.cancelInactive(workspace.id, recipientHash, records.map(row => row.id));
      }
      for (const row of records) {
        const prior = history.get(row.id);
        const available = !prior || prior.status === "queued" || (prior.status === "cancelled" && prior.attempts === 0);
        if (!available || Date.parse(row.scheduledAt) > clock().getTime() || attempts >= max) { summary.skipped++; continue; }
        if (options.dryRun) {
          summary.wouldSend++;
          log("email_worker_would_send", { id: row.id, kind: row.kind, scheduledAt: row.scheduledAt });
          continue;
        }
        // A queued reminder may have been resolved, superseded, or removed since the hourly snapshot.
        const latest = await repository.workspace(workspace.id);
        const currentCandidates = latest ? scanEmailCandidates(latest.data, clock()).candidates : [];
        const eligibleCurrent = options.expiryOnly ? expiryEmailCandidates(currentCandidates) : currentCandidates;
        const current = eligibleCurrent.find(candidate =>
          candidate.eventKey === row.eventKey && (candidate.kind === row.kind || row.kind === "approval_reminder" && candidate.kind === "approval_initial"));
        if (!current) {
          await repository.cancel(row.id); summary.cancelled++; summary.skipped++; continue;
        }
        const message = row.kind === "approval_reminder" ? reminder(current).message : current.message;
        if (!await repository.startAttempt(row.id, message, clock().toISOString())) { summary.skipped++; continue; }
        attempts++;
        let result: SendResult;
        try { result = await options.sender!(row.id, route!.recipient, message); } catch {
          result = { status: "uncertain", errorCode: "sender_interrupted", errorDetail: "Acceptance unknown; automatic retry is disabled." };
        }
        const finished = clock();
        await repository.finishAttempt(row.id, result, finished.toISOString());
        if (result.status === "accepted") {
          summary.sent++;
          if (row.kind === "approval_initial") {
            await repository.enqueue(emailRecord(reminder(current), workspace.id, recipientHash, finished,
              new Date(finished.getTime() + DAY_MS).toISOString()));
          }
        } else if (result.status === "failed") summary.failed++;
        else summary.uncertain++;
        log("email_worker_attempt", {
          id: row.id, kind: row.kind, status: result.status,
          ...(result.status !== "accepted" ? { errorCode: result.errorCode } : {}),
        });
        await (options.pause?.() ?? new Promise(resolve => setTimeout(resolve, 600)));
      }
    }
    log("email_worker_completed", summary);
    return summary;
  } catch (error) {
    summary.failed++;
    if (!options.dryRun && options.expiryOnly) {
      for (const route of options.routes) {
        if (!completedChecks.has(route.workspaceId)) {
          try {
            await repository.saveExpiryCheckStatus(route.workspaceId, "failed", clock().toISOString());
          } catch {
            // Preserve the original worker failure; the status becomes stale if persistence is unavailable.
          }
        }
      }
    }
    log("email_worker_aborted", { ...summary, attemptsReserved: attempts, acceptanceMayBeUnknown: true });
    throw error;
  } finally {
    if (locked) await repository.unlock();
  }
}
