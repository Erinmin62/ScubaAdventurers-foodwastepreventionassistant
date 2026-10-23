/**
 * Single-flight wrapper shared by the minute timer and authenticated scheduler.
 */
export function createMonitorRunner(run: () => Promise<void>) {
  let running = false;
  return async () => {
    if (running) return false;
    running = true;
    try {
      await run();
      return true;
    } finally {
      running = false;
    }
  };
}
