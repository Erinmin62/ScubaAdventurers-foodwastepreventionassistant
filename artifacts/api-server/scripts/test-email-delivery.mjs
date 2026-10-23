import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const outfile = "/tmp/expiryguard-email-delivery.test.cjs";
await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/email-worker/delivery.test.ts", import.meta.url))],
  outfile, bundle: true, platform: "node", format: "cjs", logLevel: "warning",
});
const result = spawnSync(process.execPath, ["--test", outfile], { stdio: "inherit", timeout: 60_000 });
process.exitCode = result.status ?? 1;
