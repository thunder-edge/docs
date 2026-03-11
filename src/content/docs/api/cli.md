---
title: "CLI Commands"
description: "Complete command-line reference for the Thunder edge runtime binary."
---

Thunder is invoked through the `thunder` binary. All commands follow the same top-level syntax.

```bash
thunder [GLOBAL_OPTIONS] <COMMAND> [COMMAND_OPTIONS]
```

## Global Options

These options apply to every subcommand.

| Flag | Default | Env | Description |
|------|---------|-----|-------------|
| `-v, --verbose` | off | `RUST_LOG` | Enable debug logging |
| `--log-format <pretty\|json>` | `pretty` | `EDGE_RUNTIME_LOG_FORMAT` | Runtime log output format |
| `--otel-enabled` | `false` | `EDGE_RUNTIME_OTEL_ENABLED` | Enable OpenTelemetry export |
| `--otel-protocol <http-protobuf>` | `http-protobuf` | `EDGE_RUNTIME_OTEL_PROTOCOL` | OTLP transport protocol |
| `--otel-endpoint <URL>` | `http://127.0.0.1:4318` | `EDGE_RUNTIME_OTEL_ENDPOINT` | OTLP collector base URL |
| `--otel-service-name <NAME>` | `thunder` | `EDGE_RUNTIME_OTEL_SERVICE_NAME` | OTEL resource `service.name` |
| `--otel-export-interval-ms <MS>` | `5000` | `EDGE_RUNTIME_OTEL_EXPORT_INTERVAL_MS` | Periodic export interval |
| `--otel-export-timeout-ms <MS>` | `10000` | `EDGE_RUNTIME_OTEL_EXPORT_TIMEOUT_MS` | OTEL export timeout |
| `--otel-enable-traces` | `true` | `EDGE_RUNTIME_OTEL_ENABLE_TRACES` | Enable OTEL trace signal |
| `--otel-enable-metrics` | `true` | `EDGE_RUNTIME_OTEL_ENABLE_METRICS` | Enable OTEL metrics signal |
| `--otel-enable-logs` | `true` | `EDGE_RUNTIME_OTEL_ENABLE_LOGS` | Enable OTEL logs signal |
| `--otel-export-isolate-logs` | `true` | `EDGE_RUNTIME_OTEL_EXPORT_ISOLATE_LOGS` | Export isolate logs to OTEL |
| `--otel-isolate-log-batch-size <N>` | `256` | `EDGE_RUNTIME_OTEL_ISOLATE_LOG_BATCH_SIZE` | Max isolate logs per drain tick |

---

## `start`

Start the edge runtime server with a dual-listener architecture.

- **Admin listener** (default port `9000`): serves `/_internal/*` management endpoints with optional API key authentication.
- **Ingress listener** (default port `8080` or Unix socket): serves function invocation requests at `/{function_name}/*` without authentication.

### Usage

```bash
thunder start [OPTIONS]
```

### Admin Listener Options

| Flag | Default | Env | Description |
|------|---------|-----|-------------|
| `--admin-host <HOST>` | `0.0.0.0` | `EDGE_RUNTIME_ADMIN_HOST` | Admin listener bind address |
| `--admin-port <PORT>` | `9000` | `EDGE_RUNTIME_ADMIN_PORT` | Admin listener port |
| `--api-key <KEY>` | none | `EDGE_RUNTIME_API_KEY` | API key for `/_internal/*` endpoints |
| `--admin-tls-cert <PATH>` | none | `EDGE_RUNTIME_ADMIN_TLS_CERT` | TLS certificate for admin listener |
| `--admin-tls-key <PATH>` | none | `EDGE_RUNTIME_ADMIN_TLS_KEY` | TLS private key for admin listener |

### Ingress Listener Options

| Flag | Default | Env | Description |
|------|---------|-----|-------------|
| `--host <HOST>` | `0.0.0.0` | `EDGE_RUNTIME_HOST` | Ingress listener bind address |
| `-p, --port <PORT>` | `8080` | `EDGE_RUNTIME_PORT` | Ingress listener TCP port |
| `--unix-socket <PATH>` | none | `EDGE_RUNTIME_UNIX_SOCKET` | Unix socket path (mutually exclusive with `--port`) |
| `--tls-cert <PATH>` | none | `EDGE_RUNTIME_TLS_CERT` | TLS certificate for ingress (TCP only) |
| `--tls-key <PATH>` | none | `EDGE_RUNTIME_TLS_KEY` | TLS private key for ingress (TCP only) |

### Isolate Resource Limits

| Flag | Default | Env | Description |
|------|---------|-----|-------------|
| `--max-heap-mib <MIB>` | `128` | `EDGE_RUNTIME_MAX_HEAP_MIB` | Per-isolate heap limit. `0` = unlimited |
| `--cpu-time-limit-ms <MS>` | `50000` | `EDGE_RUNTIME_CPU_TIME_LIMIT_MS` | Per-request CPU time limit. `0` = unlimited |
| `--wall-clock-timeout-ms <MS>` | `60000` | `EDGE_RUNTIME_WALL_CLOCK_TIMEOUT_MS` | Per-request wall clock timeout. `0` = unlimited |
| `--vfs-total-quota-bytes <BYTES>` | `10485760` | `EDGE_RUNTIME_VFS_TOTAL_QUOTA_BYTES` | Writable VFS quota per isolate (10 MiB) |
| `--vfs-max-file-bytes <BYTES>` | `5242880` | `EDGE_RUNTIME_VFS_MAX_FILE_BYTES` | Max writable file size in VFS (5 MiB) |

### Isolate Pool Controls

| Flag | Default | Env | Description |
|------|---------|-----|-------------|
| `--pool-enabled` | `false` | `EDGE_RUNTIME_POOL_ENABLED` | Enable isolate pooling |
| `--pool-global-max-isolates <N>` | `256` | `EDGE_RUNTIME_POOL_GLOBAL_MAX_ISOLATES` | Global isolate cap |
| `--pool-min-free-memory-mib <MIB>` | `256` | `EDGE_RUNTIME_POOL_MIN_FREE_MEMORY_MIB` | Min free memory for scale-up |
| `--context-pool-enabled` | `false` | `EDGE_RUNTIME_CONTEXT_POOL_ENABLED` | Enable context-first scheduling |
| `--max-contexts-per-isolate <N>` | `8` | `EDGE_RUNTIME_MAX_CONTEXTS_PER_ISOLATE` | Max contexts per isolate |
| `--max-active-requests-per-context <N>` | `1` | `EDGE_RUNTIME_MAX_ACTIVE_REQUESTS_PER_CONTEXT` | Max active requests per context |

### Connection and Rate Limits

| Flag | Default | Env | Description |
|------|---------|-----|-------------|
| `--max-connections <N>` | `10000` | `EDGE_RUNTIME_MAX_CONNECTIONS` | Max concurrent connections across listeners |
| `--rate-limit <RPS>` | `0` | `EDGE_RUNTIME_RATE_LIMIT` | Requests per second. `0` = unlimited |
| `--max-request-body-size <BYTES>` | `5242880` | `EDGE_RUNTIME_MAX_REQUEST_BODY_SIZE` | Max request body (5 MiB) |
| `--max-response-body-size <BYTES>` | `10485760` | `EDGE_RUNTIME_MAX_RESPONSE_BODY_SIZE` | Max response body (10 MiB) |

### Security Options

| Flag | Default | Env | Description |
|------|---------|-----|-------------|
| `--disable-ssrf-protection` | `false` | `EDGE_RUNTIME_DISABLE_SSRF_PROTECTION` | Allow `fetch()` to private IPs |
| `--allow-private-net <CIDR,...>` | none | `EDGE_RUNTIME_ALLOW_PRIVATE_NET` | Allow specific private subnets |
| `--require-bundle-signature` | `false` | `EDGE_RUNTIME_REQUIRE_BUNDLE_SIGNATURE` | Require Ed25519 bundle signatures |
| `--bundle-public-key-path <PATH>` | none | `EDGE_RUNTIME_BUNDLE_PUBLIC_KEY_PATH` | Ed25519 public key for verification |

SSRF protection blocks `fetch()` requests to private IP ranges by default:

| Range | Description |
|-------|-------------|
| `127.0.0.0/8` | Loopback |
| `10.0.0.0/8` | RFC 1918 private |
| `172.16.0.0/12` | RFC 1918 private |
| `192.168.0.0/16` | RFC 1918 private |
| `169.254.0.0/16` | Link-local / cloud metadata |
| `0.0.0.0/8` | Reserved |
| `::1/128` | IPv6 loopback |
| `fc00::/7` | IPv6 unique local |
| `fe80::/10` | IPv6 link-local |

### Proxy Options

| Flag | Env | Description |
|------|-----|-------------|
| `--http-outgoing-proxy <URL>` | `EDGE_RUNTIME_HTTP_OUTGOING_PROXY` | Outgoing HTTP proxy |
| `--https-outgoing-proxy <URL>` | `EDGE_RUNTIME_HTTPS_OUTGOING_PROXY` | Outgoing HTTPS proxy |
| `--tcp-outgoing-proxy <HOST:PORT>` | `EDGE_RUNTIME_TCP_OUTGOING_PROXY` | Generic TCP proxy |
| `--http-no-proxy <HOSTS>` | `EDGE_RUNTIME_HTTP_NO_PROXY` | HTTP proxy bypass list |
| `--https-no-proxy <HOSTS>` | `EDGE_RUNTIME_HTTPS_NO_PROXY` | HTTPS proxy bypass list |
| `--tcp-no-proxy <HOSTS>` | `EDGE_RUNTIME_TCP_NO_PROXY` | TCP proxy bypass list |

### Other Options

| Flag | Default | Env | Description |
|------|---------|-----|-------------|
| `--graceful-exit-timeout <SECS>` | `30` | -- | Graceful shutdown deadline |
| `--print-isolate-logs` | `true` | `EDGE_RUNTIME_PRINT_ISOLATE_LOGS` | Print isolate `console.*` to stdout |
| `--sourcemap <none\|inline>` | `none` | `EDGE_RUNTIME_SOURCE_MAP` | Source map handling for ESZIP modules |
| `--dns-doh-endpoint <URL>` | `https://1.1.1.1/dns-query` | `EDGE_RUNTIME_DNS_DOH_ENDPOINT` | DoH endpoint for `node:dns` |
| `--dns-max-answers <N>` | `16` | `EDGE_RUNTIME_DNS_MAX_ANSWERS` | Max DNS answers per query |
| `--dns-timeout-ms <MS>` | `2000` | `EDGE_RUNTIME_DNS_TIMEOUT_MS` | DNS resolver timeout |

### Examples

Basic development server:

```bash
thunder start
```

Production with authentication:

```bash
thunder start \
  --api-key "$(cat /run/secrets/api-key)" \
  --port 8080 \
  --max-heap-mib 256
```

Unix socket ingress:

```bash
thunder start \
  --api-key "super-secret" \
  --unix-socket /var/run/thunder.sock
```

TLS on both listeners:

```bash
thunder start \
  --api-key "secret" \
  --admin-tls-cert /certs/admin.crt \
  --admin-tls-key /certs/admin.key \
  --tls-cert /certs/ingress.crt \
  --tls-key /certs/ingress.key \
  --port 8443
```

Environment variable configuration:

```bash
export EDGE_RUNTIME_API_KEY="my-secret-key"
export EDGE_RUNTIME_PORT=8080
export EDGE_RUNTIME_ADMIN_PORT=9000
thunder start
```

Security hardened deployment:

```bash
thunder start \
  --api-key "$(cat /run/secrets/api-key)" \
  --port 8080 \
  --max-heap-mib 256 \
  --max-request-body-size 1048576 \
  --max-response-body-size 5242880 \
  --max-connections 5000
```

Corporate network with internal service access:

```bash
thunder start \
  --api-key "secret" \
  --allow-private-net "10.0.0.0/8"
```

---

## `bundle`

Bundle a JavaScript/TypeScript entrypoint and its dependencies into a deployable package.

### Usage

```bash
thunder bundle --entrypoint <FILE> --output <FILE> [OPTIONS]
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `-e, --entrypoint <FILE>` | required | Entry JS/TS file |
| `-o, --output <FILE>` | required | Output bundle file path |
| `--format <eszip\|snapshot>` | `eszip` | Package format |
| `--manifest <PATH>` | none | Path to function manifest (v2) |

The `snapshot` format packages a V8 snapshot envelope with an embedded ESZIP fallback. If the snapshot is incompatible at runtime (V8 version mismatch), startup falls back to ESZIP automatically.

When `--manifest` is provided with `flavor: "routed-app"` and an empty `routes` array, the CLI auto-scans a `functions/` directory and populates routes. If a sibling `public/` directory exists, static asset routes are generated per file.

For TypeScript entrypoints, the bundler runs `deno check` first when `deno` is in PATH. Otherwise it falls back to syntax/module-graph validation.

### Examples

Bundle a single function:

```bash
thunder bundle \
  --entrypoint ./examples/hello/hello.ts \
  --output ./hello.eszip
```

Bundle with snapshot format:

```bash
thunder bundle \
  --entrypoint ./examples/hello/hello.ts \
  --output ./hello.snapshot.bundle \
  --format snapshot
```

Bundle a routed app with manifest:

```bash
thunder bundle \
  --entrypoint ./functions/index.ts \
  --manifest ./function.manifest.json \
  --output ./app.eszip
```

---

## `watch`

Watch a directory for file changes, automatically bundle discovered JS/TS files, and deploy or update functions live.

### Usage

```bash
thunder watch [OPTIONS]
```

### Options

| Flag | Default | Env | Description |
|------|---------|-----|-------------|
| `--path <PATH>` | `.` | -- | Directory to scan and watch |
| `--host <HOST>` | `0.0.0.0` | `EDGE_RUNTIME_HOST` | Bind address |
| `-p, --port <PORT>` | `9000` | `EDGE_RUNTIME_PORT` | Listener port |
| `--interval <MS>` | `1000` | -- | Debounce interval after file changes |
| `--format <eszip\|snapshot>` | `snapshot` | -- | Bundle format for auto-deploy |
| `--max-heap-mib <MIB>` | `128` | `EDGE_RUNTIME_MAX_HEAP_MIB` | Per-isolate heap limit |
| `--cpu-time-limit-ms <MS>` | `50000` | `EDGE_RUNTIME_CPU_TIME_LIMIT_MS` | CPU time limit |
| `--wall-clock-timeout-ms <MS>` | `60000` | `EDGE_RUNTIME_WALL_CLOCK_TIMEOUT_MS` | Wall clock timeout |
| `--inspect [PORT]` | `9229` | -- | V8 inspector base port |
| `--inspect-brk` | off | -- | Break on first statement |
| `--inspect-allow-remote` | off | -- | Bind inspector to `0.0.0.0` |

The watcher scans recursively for `.ts` and `.js` files, skipping `node_modules`, `dist`, `build`, `.next`, `.deno`, and `target` directories. File paths are converted to function names by joining path segments with `-` and removing the extension.

SSRF protection is disabled in watch mode. Functions are deployed without a manifest.

For multiple functions, inspector ports auto-increment from the base port.

### Examples

```bash
thunder watch \
  --path ./examples \
  --port 9000 \
  --interval 500 \
  --inspect 9230
```

---

## `test`

Run JavaScript/TypeScript test files in an isolated runtime.

### Usage

```bash
thunder test [OPTIONS]
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `-p, --path <PATH>` | `./tests/js/**/*.ts` | Path, directory, or glob pattern |
| `-i, --ignore <PATTERN>` | none | Ignore pattern (repeatable) |
| `--inspect [PORT]` | `9229` | Enable V8 inspector |
| `--inspect-allow-remote` | off | Bind inspector to `0.0.0.0` |

Supported extensions: `.ts`, `.js`, `.mts`, `.mjs`.

When `--inspect` is used, exactly one test file must be selected.

### Examples

Run all tests except helpers:

```bash
thunder test \
  --path "./tests/js/**/*.ts" \
  --ignore "./tests/js/lib/**"
```

Debug a single test file:

```bash
thunder test --path ./tests/js/my_test.ts --inspect 9229
```

---

## `check`

Typecheck source files using `deno check`, or fall back to syntax/module validation when Deno is unavailable.

### Usage

```bash
thunder check [OPTIONS]
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `-p, --path <PATH>` | `./**/*.{ts,js,mts,mjs,tsx,jsx,cjs,cts}` | Path, directory, or glob pattern |
| `-i, --ignore <PATTERN>` | none | Ignore pattern (repeatable) |

Supported extensions: `.ts`, `.js`, `.mts`, `.mjs`, `.tsx`, `.jsx`, `.cjs`, `.cts`.

### Examples

Check a directory:

```bash
thunder check --path ./examples
```

Check with exclusions:

```bash
thunder check \
  --path "./**/*.{ts,tsx}" \
  --ignore "./target/**" \
  --ignore "./node_modules/**"
```

---

## Exit Codes

All commands return a non-zero exit code on failure. Common failure causes:

- Invalid or missing paths
- Module graph or build failures
- Bundling or deployment errors
- Test failures
- `deno check` type errors
