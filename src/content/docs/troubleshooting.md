---
title: "Troubleshooting"
---

Common issues you may encounter when developing with Thunder, along with their solutions.

## 1. "deno is not installed" warning during bundle or check

The `thunder bundle` and `thunder check` commands shell out to `deno` for TypeScript type-checking. If Deno is not on your `PATH`, you will see a warning.

**Solution:** Install Deno:

```bash
# macOS
brew install deno

# Linux / macOS (alternative)
curl -fsSL https://deno.land/install.sh | sh
```

Thunder itself does not require Deno at runtime -- only for the optional type-check step during bundling. You can skip the check with `--no-check` if needed.

## 2. Watch mode not picking up file changes

If `thunder watch` is running but changes to your `.ts` or `.js` files are not triggering a reload:

**Check the `--path` flag.** Make sure it points to the correct file or directory:

```bash
# Single file
thunder watch --path ./examples/hello/hello.ts

# Directory
thunder watch --path ./examples/hello/
```

**Check file extensions.** The watcher only monitors `.ts`, `.js`, `.tsx`, `.jsx`, and `.json` files by default.

**Check skipped directories.** The watcher automatically skips `node_modules`, `dist`, `target`, `.git`, and hidden directories (those starting with `.`).

**Check disk space.** On macOS, the watcher may silently stop if disk space is critically low. The `make watch` target includes a disk-space check (`MIN_WATCH_FREE_KB`).

## 3. Inspector not connecting

When using `--inspect <port>` for Chrome DevTools debugging:

```bash
thunder watch --path ./my-function.ts --inspect 9229
```

**Check the port.** Open `chrome://inspect` in Chrome and verify the port matches. The default is `9229`.

**One file only.** The `--inspect` flag works in single-file mode. If you pass a directory to `--path`, the inspector attaches to the first isolate only. For predictable results, point `--path` at a single entry file.

**Test mode.** When using `thunder test --inspect`, only one test file should be specified, since each test file runs in its own isolate.

## 4. Port already in use

If Thunder fails to start with an "address already in use" error:

**Find and kill the process occupying the port:**

```bash
# Find what is using port 9000 (ingress) or 9001 (admin)
lsof -ti :9000 | xargs kill -9
lsof -ti :9001 | xargs kill -9
```

**Use a different port:**

```bash
thunder start --port 8080 --admin-port 8081
```

## 5. 401 Unauthorized on admin API

If requests to the admin API (default port 9001) return `401 Unauthorized`:

**Check the API key.** When Thunder is started with `--api-key`, every admin request must include the key in the `X-API-Key` header:

```bash
thunder start --api-key my-secret-key
```

```bash
# This will fail with 401:
curl http://localhost:9001/functions

# This works:
curl http://localhost:9001/functions -H "X-API-Key: my-secret-key"
```

If you are in a development environment and do not need admin authentication, omit the `--api-key` flag.

## 6. 413 Payload Too Large

If POST or PUT requests return `413 Payload Too Large`:

**Increase the maximum request body size:**

```bash
thunder start --max-request-body-size 10485760
```

The value is in bytes. The default is 1 MiB (1048576 bytes). The example above sets it to 10 MiB.

## 7. Function timeout (504 Gateway Timeout)

If your function takes too long and returns a `504` status:

**Increase the wall-clock timeout:**

```bash
thunder start --wall-clock-timeout-ms 30000
```

The default is 10000 ms (10 seconds). Increase it for functions that perform slow outbound fetches or heavy computation.

**Optimize your function.** Common causes of timeouts:
- Fetching slow external APIs without an `AbortController` timeout.
- CPU-intensive loops that block the event loop.
- Unbounded data processing.

## 8. SSRF-blocked fetch requests

Thunder blocks outbound `fetch()` calls to private and internal IP ranges by default (SSRF protection). If your function needs to call internal services, you will see an error like "request to private network blocked".

**Allow private network access for specific cases:**

```bash
thunder start --allow-private-net
```

**Disable SSRF protection entirely (development only):**

```bash
thunder start --disable-ssrf-protection
```

Do not disable SSRF protection in production. Use `--allow-private-net` selectively if your architecture requires internal service calls.

## 9. Snapshot V8 version mismatch

If you see an error about a V8 snapshot version mismatch when loading a `.snapshot.bundle` file:

**Regenerate the snapshot** with the current Thunder version:

```bash
thunder bundle --entrypoint ./my-function.ts --output ./my-function.snapshot.bundle --format snapshot
```

Snapshot bundles embed a serialized V8 heap that is tied to the exact V8 version compiled into Thunder. When you upgrade Thunder, previously generated snapshots become incompatible and must be rebuilt.

Eszip bundles (`.eszip`) do not have this limitation -- they contain source code that is compiled fresh on each load.

## 10. No OpenTelemetry traces or logs appearing

If you have an OTEL collector running but no data is flowing:

**Enable OTEL export:**

```bash
thunder start --otel-enabled
```

OTEL export is disabled by default.

**Check the endpoint.** Thunder sends data to `http://localhost:4318` by default (OTLP HTTP). Override with environment variables if your collector is elsewhere:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318 thunder start --otel-enabled
```

**Disable console log printing when using OTEL.** By default, Thunder prints `console.log` output from isolates to stdout. When exporting logs via OTEL, disable console printing to avoid duplication:

```bash
thunder start --otel-enabled --print-isolate-logs false
```

**Use the observability stack.** The repository includes a ready-to-use Docker Compose stack in `observability/` with Grafana, Prometheus, Tempo, and Loki:

```bash
cd observability
docker compose up -d
```

Then start Thunder with the observability script:

```bash
./scripts/start-observability-runtime.sh
```

Grafana will be available at `http://localhost:3000`.
