---
name: Resend worker builds
description: Build and test a scheduled worker that sends through the Replit-managed Resend connector.
---

Keep `@replit/connectors-sdk` external to esbuild's ESM bundle and import it lazily only when a send is attempted. Bundling the SDK into ESM caused its CommonJS identity module's dynamic `require("node:child_process")` to fail. Inject the connector proxy in unit tests so test runs do not need Replit connection credentials.

**Why:** The worker runs as an ESM bundle in a scheduled deployment, while the connector SDK includes runtime identity code that relies on Node's CommonJS loader.

**How to apply:** When changing the worker build or test bundling, keep the SDK external and test sending behavior through an injected proxy. Verify the built CLI starts in dry-run mode without resolving a live connection.
