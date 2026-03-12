---
title: "Project Structure"
---

Thunder is organized as a Cargo workspace with four crates, plus supporting directories for documentation, examples, tests, and operational tooling.

## Directory layout

```
deno-edge-runtime/
├── crates/
│   ├── cli/              # CLI binary (thunder)
│   ├── server/           # HTTP server (ingress + admin listeners)
│   ├── functions/        # Function registry, handler dispatch, lifecycle
│   └── runtime-core/     # V8 isolate, extensions, bootstrap, Node.js polyfills
├── docs/                 # Documentation site (Starlight)
├── examples/             # 30 example edge functions
├── tests/
│   └── js/               # JavaScript/TypeScript test suites
├── schemas/              # JSON Schema definitions for manifests
├── scripts/              # Automation, benchmarking, and deployment scripts
├── observability/        # Docker Compose observability stack (Grafana, Prometheus, Tempo, Loki)
├── Cargo.toml            # Workspace root
├── Cargo.lock
├── Makefile              # Common dev shortcuts (build, run, test, watch)
├── rust-toolchain.toml   # Pinned Rust stable version
└── install.sh            # One-line installer for stable/unstable releases
```

## Crates

### `crates/cli/` -- CLI binary (`thunder`)

The entry point for the entire runtime. Parses command-line arguments with `clap` and dispatches to subcommands: `start`, `watch`, `test`, `bundle`, and `check`.

Key files:

| File | Role |
|---|---|
| `main.rs` | Binary entry point, Tokio runtime bootstrap. |
| `commands/` | Subcommand implementations (`start`, `watch`, `test`, `bundle`, `check`). |
| `telemetry.rs` | OpenTelemetry and tracing initialization. |

### `crates/server/` -- HTTP server

Implements the dual-listener HTTP server using `hyper` and `tower`. Handles ingress traffic (user requests routed to edge functions) and admin traffic (function deployment, health checks).

Key files:

| File | Role |
|---|---|
| `lib.rs` | Public API surface for the server crate. |
| `ingress_router.rs` | Routes incoming user requests to the correct function. |
| `admin_router.rs` | Admin API endpoints (deploy, undeploy, list, health). |
| `service.rs` | Tower service implementation that bridges Hyper and the function handler. |
| `body_limits.rs` | Request body size enforcement. |
| `bundle_signature.rs` | HMAC signature verification for signed bundles. |
| `function_route_matcher.rs` | Path pattern matching for function routing. |
| `global_routing.rs` | Global routing manifest support. |
| `graceful.rs` | Graceful shutdown coordination. |
| `tls.rs` | TLS termination with Rustls. |
| `trace_context.rs` | W3C Trace Context propagation. |
| `middleware/` | Tower middleware layers (CORS, compression, tracing). |

### `crates/functions/` -- Function registry and lifecycle

Manages the lifecycle of deployed edge functions: registration, isolate allocation from the pool, request dispatch, and cleanup.

Key files:

| File | Role |
|---|---|
| `lib.rs` | Crate root, re-exports. |
| `registry.rs` | In-memory function registry (thread-safe `DashMap`). |
| `handler.rs` | Bridges an inbound HTTP request to a V8 isolate execution. |
| `lifecycle.rs` | Isolate warm-up, idle eviction, and shutdown logic. |
| `snapshot.rs` | Snapshot-based bundle loading. |
| `connection_manager.rs` | Tracks active connections per function. |
| `metrics.rs` | Per-function metrics (request count, latency, errors). |
| `types.rs` | Shared type definitions. |

### `crates/runtime-core/` -- V8 isolate and runtime

The lowest-level crate. Creates and manages V8 isolates via `deno_core`, registers Deno extensions (fetch, crypto, WebSocket, etc.), bootstraps the JavaScript runtime environment, and provides Node.js compatibility polyfills.

Key files and directories:

| Path | Role |
|---|---|
| `isolate.rs` | V8 isolate creation, configuration, and execution loop. |
| `extensions.rs` | Registers all Deno extensions (web, fetch, crypto, net, WebSocket, etc.). |
| `module_loader.rs` | Custom module loader for eszip and snapshot bundles. |
| `bootstrap.js` | JavaScript bootstrap script executed on isolate startup. |
| `http_serve_shim.js` | Shim for `Deno.serve()` that bridges JS handlers to Rust. |
| `global_scope_shim.js` | Global scope setup (console, timers, etc.). |
| `permissions.rs` | Deno permissions model configuration. |
| `ssrf.rs` | SSRF protection (blocks fetch to private/internal networks). |
| `cpu_timer.rs` | Wall-clock and CPU time enforcement. |
| `mem_check.rs` | Memory usage monitoring per isolate. |
| `isolate_logs.rs` | Captures `console.log` output and routes to tracing/OTEL. |
| `manifest.rs` | Function manifest parsing and validation. |
| `node_compat/` | Node.js polyfills (40+ modules: `fs`, `crypto`, `path`, `buffer`, `stream`, etc.). |
| `http/` | HTTP request/response helpers and the `thunder:http` module. |
| `assert/` | Built-in assertion library for the test runner. |
| `runtime_shims/` | Additional runtime compatibility shims. |
| `internal/` | Internal utilities not exposed to user code. |

## Examples

The `examples/` directory contains 30 self-contained edge functions, each in its own subdirectory with a single `.ts` entry file. See [Examples](/docs/examples/overview/) for the full list.

## Tests

- **`tests/js/`** -- TypeScript test suites that exercise the runtime from the JavaScript side. Run with `make test-js` or `thunder test --path "./tests/js/**/*.ts"`.
- Each Rust crate contains its own `#[cfg(test)]` modules and integration tests under `tests/`.

## Schemas

The `schemas/` directory holds JSON Schema definitions for:

- `function-manifest.v1.schema.json` / `function-manifest.v2.schema.json` -- Function manifest format.
- `routing-manifest.v1.schema.json` -- Global routing manifest format.

## Scripts

Automation scripts in `scripts/` cover bundling (`bundle-eszip.sh`, `bundle-snapshot.sh`), deployment (`deploy-and-test-eszip.sh`, `deploy-signed-bundle.sh`), benchmarking (`run-benchmarks.sh`, `k6_1k_rps.js`), and observability (`start-observability-runtime.sh`).

## Observability

The `observability/` directory contains a Docker Compose stack with Grafana, Prometheus, Tempo, Loki, and an OpenTelemetry Collector for local development and debugging of traces, metrics, and logs.
