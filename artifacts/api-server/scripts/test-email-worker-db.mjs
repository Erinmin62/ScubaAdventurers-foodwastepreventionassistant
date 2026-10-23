import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

if (process.env.REPLIT_DEPLOYMENT || process.env.NODE_ENV === "production") {
  throw new Error("Database tests may run only against the development database.");
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outfile = "/tmp/expiryguard-email-db/email-worker-db.test.mjs";
await build({
  entryPoints: [path.join(root, "src/lib/email-worker/email-worker-db.test.ts")],
  outfile, bundle: true, platform: "node", format: "esm", external: ["pg-native"],
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; globalThis.require = __createRequire(import.meta.url);" },
});
const result = spawnSync(process.execPath, ["--test", outfile], {
  stdio: "inherit", timeout: 90_000, env: { ...process.env, NODE_ENV: "test" },
});
process.exitCode = result.status ?? 1;
