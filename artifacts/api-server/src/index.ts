import app from "./app";
import { logger } from "./lib/logger";
import { changeWorkspace } from "./lib/guard-store";
import { today } from "./lib/guard-model";
import { runTwilioSandbox } from "./lib/guard-sandbox";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  // The server performs lightweight checks while active; requests also catch up after downtime.
  let checking = false;
  const check = async () => {
    if (checking) return;
    checking = true;
    try {
      await changeWorkspace();
      await runTwilioSandbox({ mutate: changeWorkspace });
    }
    catch (err) {
      logger.error({ err }, "Automation check failed; will retry on the next interval or request");
      // Persist a bounded operational event if storage still works. Never
      // include raw exception text/credentials in an owner-facing message.
      try {
        await changeWorkspace(s => {
          const id = `monitor-failure:${today()}`;
          if (!s.activity.some(a => a.id === id)) s.activity.unshift({
            id, time: new Date().toISOString(), title: "Background workflow needs attention",
            detail: "An automated inventory/planning check failed. Review server logs and current stock before making decisions. No action has been automatically approved.",
            decision: "workflow-failed", impact: 0,
          });
        }, false);
      } catch { logger.warn("Unable to persist workflow failure; database or analysis may be unavailable"); }
    }
    finally { checking = false; }
  };
  void check();
  setInterval(() => void check(), 60_000).unref();
});
