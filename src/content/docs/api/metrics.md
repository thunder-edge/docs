---
title: "Metrics Endpoint"
description: "Complete field-by-field reference for the Thunder runtime metrics JSON."
---

Thunder exposes runtime and per-function metrics as a JSON object on two endpoints.

## Endpoints

| Method | Path | Listener |
|--------|------|----------|
| `GET` | `/_internal/metrics` | Admin (port 9000) |
| `GET` | `/metrics` | Admin (port 9000, alias) |

Both endpoints return the same JSON payload.

## Caching

Metrics are cached in memory with a 15-second TTL.

- Without `?fresh=1`, the endpoint returns the cached snapshot if it is less than 15 seconds old.
- With `?fresh=1`, the endpoint recomputes immediately and refreshes the cache.

```bash
curl -s http://localhost:9000/metrics | jq
curl -s 'http://localhost:9000/metrics?fresh=1' | jq '.process_saturation'
curl -s 'http://localhost:9000/_internal/metrics?fresh=1' | jq '.routing'
```

If admin API key authentication is enabled, `/_internal/*` routes require the `X-API-Key` header. The `/metrics` alias does not use the `/_internal` prefix.

---

## Top-Level Schema

```json
{
  "function_count": 5,
  "total_requests": 12340,
  "total_errors": 12,
  "total_cold_starts": 50,
  "avg_cold_start_ms": 45,
  "avg_cold_start_us": 45320,
  "avg_cold_start_ms_precise": 45.32,
  "avg_warm_start_ms": 2,
  "avg_warm_start_us": 2150,
  "avg_warm_start_ms_precise": 2.15,
  "total_cold_start_time_us": 2266000,
  "total_warm_start_time_us": 26531000,
  "memory": { ... },
  "process_saturation": { ... },
  "routing": { ... },
  "listener_connection_capacity": { ... },
  "egress_connection_manager": { ... },
  "top10": { ... },
  "functions": [ ... ]
}
```

### Global Aggregates

| Field | Type | Description |
|-------|------|-------------|
| `function_count` | integer | Number of deployed functions |
| `total_requests` | integer | Sum of all function requests |
| `total_errors` | integer | Sum of all function errors |
| `total_cold_starts` | integer | Sum of all cold starts |
| `avg_cold_start_ms` | integer | Average cold start time (ms, rounded down) |
| `avg_cold_start_us` | integer | Average cold start time (microseconds, rounded down) |
| `avg_cold_start_ms_precise` | float | Average cold start time (ms, precise) |
| `avg_warm_start_ms` | integer | Average warm request time (ms, rounded down) |
| `avg_warm_start_us` | integer | Average warm request time (microseconds, rounded down) |
| `avg_warm_start_ms_precise` | float | Average warm request time (ms, precise) |
| `total_cold_start_time_us` | integer | Aggregate cold start elapsed time (microseconds) |
| `total_warm_start_time_us` | integer | Aggregate warm request elapsed time (microseconds) |

Averages are `0` (or `0.0`) when the divisor is zero.

---

## `memory`

Process and host memory snapshot.

| Field | Type | Unit | Description |
|-------|------|------|-------------|
| `process_memory_mb` | float | MB | Current process memory from `sysinfo` |
| `total_memory_mib` | float | MiB | Host total memory |
| `available_memory_mib` | float | MiB | Host available memory (max of available and free) |
| `estimated_per_function_mb` | float | MB | `process_memory_mb / function_count` (`0.0` with no functions) |

---

## `process_saturation`

Global autoscaling signal derived from memory, CPU, pool, and file descriptor pressure.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `score` | float | Global saturation score in `[0.0, 1.0]` |
| `level` | string | `healthy`, `warning`, or `critical` |
| `should_scale_out` | boolean | `true` when `score >= 0.75` |
| `active_signals` | string[] | Components at or above 0.75 |
| `thresholds` | object | `{ warning: 0.75, critical: 0.90 }` |
| `components` | object | Normalized component values |
| `debug` | object | Raw memory values for diagnostics |

### Level Thresholds

| Level | Condition |
|-------|-----------|
| `healthy` | `score < 0.75` |
| `warning` | `0.75 <= score < 0.90` |
| `critical` | `score >= 0.90` |

### Components

| Component | Formula |
|-----------|---------|
| `memory` | `max(memory_process_raw, memory_host_raw * memory_process_raw)` |
| `cpu` | Ratio of accumulated CPU time to warm request time |
| `pool_isolates` | `routing.total_isolates / sum(functions[*].pool.max)` |
| `pool_contexts` | `routing.saturated_contexts / routing.total_contexts` |
| `pool` | `max(pool_isolates, pool_contexts)` |
| `fd` | Max of runtime FD pressure and listener clamp pressure |

The `score` is the maximum across all components.

---

## `routing`

Scheduler and capacity state snapshot.

| Field | Type | Description |
|-------|------|-------------|
| `total_contexts` | integer | Logical contexts currently tracked |
| `total_isolates` | integer | Isolate count from routing rollups |
| `global_pool_total_isolates` | integer | Alive isolates from global pool accounting |
| `global_pool_max_isolates` | integer | Configured global isolate cap |
| `isolate_accounting_gap` | integer | `global_pool_total_isolates - total_isolates` |
| `total_active_requests` | integer | Active requests across routing entries |
| `saturated_rejections` | integer | Total route-target capacity rejections |
| `saturated_rejections_context_capacity` | integer | Rejections caused by context saturation |
| `saturated_rejections_scale_blocked` | integer | Rejections where scale-up was blocked |
| `saturated_rejections_scale_failed` | integer | Rejections where scale-up failed |
| `burst_scale_batch_last` | integer | Last burst scale batch size |
| `burst_scale_events_total` | integer | Count of burst scale events |
| `saturated_contexts` | integer | Contexts at active-request cap |
| `saturated_isolates` | integer | Fully saturated isolates |

---

## `listener_connection_capacity`

Process listener capacity considering the file descriptor budget.

| Field | Type | Description |
|-------|------|-------------|
| `configuredMaxConnections` | integer | Configured `max_connections` value |
| `effectiveMaxConnections` | integer | Post-clamp effective listener limit |
| `softLimit` | integer | Process `RLIMIT_NOFILE` soft limit |
| `reservedFd` | integer | Reserved FD headroom for system use |
| `fdBudget` | integer | FD budget available to listener capacity |

---

## `egress_connection_manager`

Global outbound lease manager snapshot.

| Field | Type | Description |
|-------|------|-------------|
| `softLimit` | integer | Process `RLIMIT_NOFILE` soft limit |
| `openFdCount` | integer | Observed open FD count |
| `reservedFd` | integer | Reserved FD for non-egress use |
| `outboundFdBudget` | integer | Estimated FD budget for outbound leases |
| `adaptiveActiveLimit` | integer | Dynamic upper bound for active leases |
| `activeLeases` | integer | Currently active leases |
| `queuedWaiters` | integer | Waiters for lease acquisition |
| `totalAcquired` | integer | Cumulative successful acquisitions |
| `totalReleased` | integer | Cumulative releases |
| `totalRejected` | integer | Cumulative rejections due to backpressure |
| `totalTimeouts` | integer | Cumulative timed-out waits |
| `totalReaped` | integer | Cumulative stale leases reaped |
| `knownTenants` | integer | Tenants currently tracked |
| `topTenantsByActive` | array | Top tenants by active leases (max 10) |
| `tokenBucket` | object | Token bucket state: `tokens`, `capacity`, `refillPerSec` |

### `topTenantsByActive` Entry

| Field | Type | Description |
|-------|------|-------------|
| `tenant` | string | Tenant identifier |
| `active` | integer | Active lease count |

### `tokenBucket`

| Field | Type | Description |
|-------|------|-------------|
| `tokens` | float | Current token count |
| `capacity` | float | Bucket capacity |
| `refillPerSec` | float | Token refill rate per second |

---

## `top10`

Ranked views computed from current function data. Each array contains up to 10 entries.

### `cold_slowest` / `cold_fastest`

| Field | Type |
|-------|------|
| `name` | string |
| `avg_cold_start_ms` | float |
| `cold_starts` | integer |

### `warm_slowest` / `warm_fastest`

| Field | Type |
|-------|------|
| `name` | string |
| `avg_warm_request_ms` | float |
| `requests` | integer |

### `cpu_bound`

| Field | Type |
|-------|------|
| `name` | string |
| `cpu_bound_ratio` | float |
| `avg_cpu_time_ms_per_request` | float |
| `avg_warm_request_ms` | float |

### `blocking_cpu`

| Field | Type |
|-------|------|
| `name` | string |
| `avg_cpu_time_ms_per_request` | float |
| `requests` | integer |

### `memory_usage`

| Field | Type |
|-------|------|
| `name` | string |
| `peak_heap_used_mb` | float |
| `current_heap_used_mb` | float |
| `peak_heap_used_bytes` | integer |

### `cpu_time_total`

| Field | Type |
|-------|------|
| `name` | string |
| `total_cpu_time_ms` | integer |
| `requests` | integer |

---

## `functions[]`

Array of per-function objects.

### Function Info

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Function slug |
| `status` | string | `loading`, `running`, `error`, `shutting_down` |
| `bundle_format` | string | `eszip` or `snapshot` |
| `package_v8_version` | string | V8 version in the deploy package |
| `runtime_v8_version` | string | V8 version in the runtime |
| `snapshot_compatible_with_runtime` | boolean | V8 versions match |
| `requires_snapshot_regeneration` | boolean | Snapshot format with V8 mismatch |
| `stored_eszip_size_bytes` | integer | Size of stored ESZIP fallback |
| `can_regenerate_snapshot_from_stored_eszip` | boolean | Whether ESZIP is available for rebuild |
| `created_at` | string | RFC 3339 timestamp |
| `updated_at` | string | RFC 3339 timestamp |
| `last_error` | string or null | Last error message |
| `pool` | object | Isolate pool snapshot |
| `metrics` | object | Function metrics |

### `functions[].pool`

| Field | Type | Description |
|-------|------|-------------|
| `min` | integer | Configured minimum isolates |
| `max` | integer | Configured maximum isolates |
| `current` | integer | Currently allocated isolates |

### `functions[].metrics`

| Field | Type | Unit |
|-------|------|------|
| `total_requests` | integer | -- |
| `active_requests` | integer | -- |
| `total_errors` | integer | -- |
| `total_cpu_time_ms` | integer | ms |
| `cold_starts` | integer | -- |
| `avg_cold_start_ms` | integer | ms |
| `total_cold_start_time_ms` | integer | ms |
| `total_cold_start_time_us` | integer | us |
| `avg_cold_start_us` | integer | us |
| `avg_cold_start_ms_precise` | float | ms |
| `total_warm_start_time_ms` | integer | ms |
| `total_warm_start_time_us` | integer | us |
| `avg_warm_request_ms` | integer | ms |
| `avg_warm_request_us` | integer | us |
| `avg_warm_request_ms_precise` | float | ms |
| `current_heap_used_bytes` | integer | bytes |
| `peak_heap_used_bytes` | integer | bytes |
| `current_heap_used_mb` | float | MB |
| `peak_heap_used_mb` | float | MB |

---

## Compatibility

- The schema is generated in the runtime server router (`build_metrics_body`).
- New fields may be added in minor runtime updates without notice.
- Clients should tolerate unknown fields.
- For strict integrations, pin the runtime version and validate expected keys.
