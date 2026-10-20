import app from "./app";
import { logger } from "./lib/logger";
import { changeWorkspace } from "./lib/guard-store";

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
    try { await changeWorkspace(); }
    catch (err) { logger.error({ err }, "Automation check failed; will retry on the next interval or request"); }
    finally { checking = false; }
  };
  void check();
  setInterval(() => void check(), 60_000).unref();
});
