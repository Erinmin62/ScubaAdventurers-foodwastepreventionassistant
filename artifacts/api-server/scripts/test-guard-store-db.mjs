import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.env.REPLIT_DEPLOYMENT || process.env.NODE_ENV === "production") {
  throw new Error("Database tests may run only against the development database.");
}
const outfile = "/tmp/expiryguard-store-db/guard-store-db.test.mjs";
await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/guard-store-db.test.ts", import.meta.url))],
  outfile, bundle: true, platform: "node", format: "esm", external: ["pg-native"],
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; globalThis.require = __createRequire(import.meta.url);" },
});
const result = spawnSync(process.execPath, ["--test", outfile], {
  stdio: "inherit", timeout: 30_000, env: { ...process.env, NODE_ENV: "test" },
});
process.exitCode = result.status ?? 1;
