import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const outfile = "/tmp/expiryguard-http.test.cjs";
await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/guard-http.test.ts", import.meta.url))],
  outfile, bundle: true, platform: "node", format: "cjs", logLevel: "warning",
  plugins: [{
    name: "isolated-workspace",
    setup(build) {
      build.onResolve({ filter: /(?:^|\/)guard-store$/ }, () => ({
        path: fileURLToPath(new URL("../src/lib/guard-http-fixture.ts", import.meta.url)),
      }));
      build.onResolve({ filter: /(?:^|\/)guard-monitor$/ }, () => ({
        path: fileURLToPath(new URL("../src/lib/guard-monitor-http-fixture.ts", import.meta.url)),
      }));
    },
  }],
});
const run = spawnSync(process.execPath, ["--test", outfile], { stdio: "inherit" });
process.exit(run.status ?? 1);
