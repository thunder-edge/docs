---
title: "Resource Limits"
description: "Per-isolate, per-server, and pool-level resource limits in Thunder."
---

Thunder enforces resource limits at multiple levels to ensure fair scheduling, prevent runaway functions, and protect the host process. All limits are configurable via CLI flags or environment variables.

---

## Per-isolate limits

These limits apply to each individual function isolate.

| Resource | CLI flag | Env var | Default | Description |
|---|---|---|---|---|
| Heap memory | `--max-heap-mib` | `EDGE_RUNTIME_MAX_HEAP_MIB` | 128 MiB | Maximum V8 heap size. The isolate is terminated if it exceeds this. |
| CPU time | `--cpu-time-limit-ms` | `EDGE_RUNTIME_CPU_TIME_LIMIT_MS` | 50000 ms | Cumulative CPU time (excludes I/O wait). Isolate is terminated when exceeded. |
| Wall-clock timeout | `--wall-clock-timeout-ms` | `EDGE_RUNTIME_WALL_CLOCK_TIMEOUT_MS` | 60000 ms | Total elapsed time from request start. Covers CPU, I/O, and idle time. |
| VFS total quota | `--vfs-total-quota-bytes` | `EDGE_RUNTIME_VFS_TOTAL_QUOTA_BYTES` | 10 MiB | Total writable bytes in `/tmp`. See [Virtual File System](/docs/platform/vfs/). |
| VFS max file size | `--vfs-max-file-bytes` | `EDGE_RUNTIME_VFS_MAX_FILE_BYTES` | 5 MiB | Maximum size of a single file in `/tmp`. |

### Behaviour on limit violation

- **Heap exceeded**: The isolate is terminated immediately. The client receives a `503 Service Unavailable` with an error body.
- **CPU time exceeded**: The V8 execution is interrupted. The client receives a `504 Gateway Timeout`.
- **Wall-clock exceeded**: The request is aborted. The client receives a `504 Gateway Timeout`.
- **VFS quota exceeded**: The `fs` write call throws an `ENOSPC` error. The isolate continues running.

---

## Per-server limits

These limits apply to the Thunder server process as a whole.

### Body size limits

| Resource | CLI flag | Env var | Default | Description |
|---|---|---|---|---|
| Request body | `--max-request-body-size` | `EDGE_RUNTIME_MAX_REQUEST_BODY_SIZE` | 5 MiB | Maximum size of an incoming request body. Requests exceeding this receive `413 Payload Too Large`. |
| Response body | `--max-response-body-size` | `EDGE_RUNTIME_MAX_RESPONSE_BODY_SIZE` | 10 MiB | Maximum size of a function response body. Responses exceeding this are truncated and the connection is closed. |

### Connection limits

| Resource | CLI flag | Env var | Default | Description |
|---|---|---|---|---|
| Max connections | `--max-connections` | `EDGE_RUNTIME_MAX_CONNECTIONS` | 10000 | Maximum concurrent TCP connections on the ingress listener. New connections beyond this are rejected with `503`. |
| Rate limit | `--rate-limit` | `EDGE_RUNTIME_RATE_LIMIT` | Unlimited | Maximum requests per second across all connections. When exceeded, requests receive `429 Too Many Requests`. |

---

## Pool limits

The isolate pool manages the lifecycle of V8 isolates across all deployed functions.

| Resource | CLI flag | Env var | Default | Description |
|---|---|---|---|---|
| Global max isolates | `--pool-global-max-isolates` | `EDGE_RUNTIME_POOL_GLOBAL_MAX_ISOLATES` | 256 | Maximum number of live isolates across all functions. |
| Min free memory | `--pool-min-free-memory-mib` | `EDGE_RUNTIME_POOL_MIN_FREE_MEMORY_MIB` | -- | When free system memory drops below this threshold, the pool evicts idle isolates. |
| Pool enabled | `--pool-enabled` | `EDGE_RUNTIME_POOL_ENABLED` | true | When disabled, a fresh isolate is created and destroyed for every request. |

Per-function pool sizes (min and max isolates per function) are configured in the function manifest, not at the server level.

---

## WebSocket limits

| Resource | Default | Description |
|---|---|---|
| Max connections per isolate | 128 | Maximum number of concurrent outbound WebSocket connections from a single isolate. |
| Connect timeout | 30 s | Maximum time to complete the WebSocket handshake. |

WebSocket connections count toward the isolate's wall-clock timeout. Long-lived WebSocket connections should account for this.

---

## Egress connection manager

Thunder includes an adaptive egress connection manager that manages the file descriptor (FD) budget for outbound connections. It ensures that `fetch()`, WebSocket, and TCP connections do not exhaust the process FD limit.

The manager:

- Tracks active outbound connections across all isolates.
- Reserves FDs for the ingress listener and internal use.
- Queues outbound connection attempts when the FD budget is saturated.
- Reports FD utilisation as part of the [scaling signal](/docs/deployment/scaling/).

The FD budget is derived from the system `ulimit -n` minus a safety margin for internal operations.

---

## Recommendations

| Scenario | Suggested tuning |
|---|---|
| CPU-bound functions (image processing, crypto) | Increase `--cpu-time-limit-ms`, keep `--max-heap-mib` at 128+. |
| I/O-bound functions (API aggregation) | Default CPU is usually sufficient. Increase `--wall-clock-timeout-ms` if external calls are slow. |
| Memory-intensive functions | Increase `--max-heap-mib`. Monitor heap usage via OTEL metrics. |
| High-traffic, low-latency functions | Reduce `--wall-clock-timeout-ms` to fail fast. Increase `--max-connections`. |
| File-heavy functions | Increase VFS quotas as needed, but stay within isolate memory budget. |

Use the `/_internal/health` and `/_internal/metrics` endpoints (or OTEL export) to monitor resource consumption and tune limits based on real traffic patterns.
