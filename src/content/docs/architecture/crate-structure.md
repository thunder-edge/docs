---
title: "Crate Structure"
description: "Workspace layout and dependency graph of the Thunder crates."
---

Thunder is organized as a Rust workspace with four crates. Each crate has a focused responsibility and a clear position in the dependency graph.

## Dependency Graph

```
cli (edge-cli) -> binary: thunder
  |-- server (edge-server)
  |     |-- functions
  |     |     `-- runtime-core
  |     `-- runtime-core
  |-- functions
  `-- runtime-core
```

The `cli` crate is the top-level entry point. It depends on all three library crates and produces the `thunder` binary. The `server` crate depends on `functions` and `runtime-core`. The `functions` crate depends on `runtime-core`. `runtime-core` sits at the bottom of the graph and has no in-workspace dependencies.

## Crate Details

### runtime-core

The foundation layer. Provides the V8 isolate primitives and everything needed to execute JavaScript and TypeScript code inside a sandboxed environment.

| Area | Contents |
|---|---|
| V8 integration | Isolate creation, snapshot support, heap and CPU limits |
| Deno extensions | Registered ops for fetch, timers, crypto, console, and more |
| Module loader | Custom `ModuleLoader` that resolves from ESZIP bundles |
| SSRF protection | IP-range blocklist applied at the DNS-resolution layer |
| Bootstrap | `bootstrap.js` -- sets up the global scope before user code runs |
| Node.js polyfills | 42 Node.js built-in module polyfills (fs, path, crypto, buffer, etc.) |
| thunder:testing | Built-in test library for function authors |
| thunder:http | HTTP response helpers and request utilities |

### functions

Manages the lifecycle of deployed functions and the pool of isolates that serve them.

| Area | Contents |
|---|---|
| FunctionRegistry | Concurrent registry backed by `DashMap` for lock-free reads |
| Isolate pool | LRU-evicted pool of warm isolates per function |
| Lifecycle management | Deploy, update, undeploy, and health-check operations |
| Handler dispatch | Routes an inbound request to the correct isolate and invokes the JS handler |
| Resource tracking | Per-request tracking of memory, open handles, and pending futures |
| Connection manager | Manages per-function connection concurrency and backpressure |

### edge-server (server)

The networking layer. Accepts connections, applies policies, and forwards valid requests into the function layer.

| Area | Contents |
|---|---|
| Dual-listener HTTP server | Separate ingress (user traffic) and admin (operator traffic) listeners |
| Admin router | REST endpoints for deploy, undeploy, status, health, and configuration |
| Ingress router | Path-based routing that extracts the function name from the first segment |
| TLS | `DynamicTlsAcceptor` with runtime-reloadable certificates via Rustls |
| Rate limiting | Token-bucket rate limiter applied per source IP |
| Body size limits | Configurable maximum request body size, enforced before buffering |
| Graceful shutdown | Drains in-flight requests on SIGTERM / SIGINT before stopping |

### edge-cli (cli)

The user-facing command-line interface that wires everything together and produces the `thunder` binary.

| Area | Contents |
|---|---|
| CLI framework | Built with `clap` (derive API) |
| `start` command | Launches the dual-listener server |
| `bundle` command | Packs a function into an ESZIP archive |
| `watch` command | File-watcher mode for local development with automatic reload |
| `test` command | Runs `thunder:testing` suites inside an isolate |
| `check` command | Type-checks TypeScript source without executing |
| OpenTelemetry setup | Initializes tracing and metrics exporters at startup |
