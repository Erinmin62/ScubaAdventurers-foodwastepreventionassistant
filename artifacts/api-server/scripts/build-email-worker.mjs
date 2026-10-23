import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";

globalThis.require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Separate output directory: building this command never removes or rebuilds the web/API bundle.
await build({
  entryPoints: [path.join(root, "src/cli/email-worker.ts")],
  outdir: path.join(root, "dist-workers"),
  outExtension: { ".js": ".mjs" },
  bundle: true, platform: "node", format: "esm", sourcemap: "linked", logLevel: "info",
  external: ["pg-native", "@replit/connectors-sdk"],
  plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; globalThis.require = __createRequire(import.meta.url);" },
});
