---
title: "Scaling"
description: "Autoscaling signals, pool tuning, and capacity management in Thunder."
---

Thunder exposes autoscaling signals and provides pool-level controls that external orchestrators (Kubernetes HPA, custom autoscalers, or manual capacity planning) can use to make scaling decisions.

---

## Process saturation signal

The `/_internal/metrics` endpoint (and OTEL metrics export) includes a composite **process saturation** signal that summarises how close the Thunder instance is to its capacity limits.

### Signal fields

| Field | Type | Description |
|---|---|---|
| `score` | `f64` (0.0 -- 1.0) | Weighted saturation score across all components. 0.0 = idle, 1.0 = fully saturated. |
| `level` | `string` | One of `normal`, `warning`, or `critical`. |
| `should_scale_out` | `bool` | `true` when the score exceeds the critical threshold. |

### Saturation components

The composite score is derived from individual component scores, each normalised to 0.0 -- 1.0:

| Component | What it measures | Source |
|---|---|---|
| `memory` | Process RSS relative to available system memory. | `/proc/meminfo` or equivalent. |
| `cpu` | CPU utilisation of the Thunder process. | Process CPU time sampling. |
| `pool_isolates` | Live isolate count relative to `pool-global-max-isolates`. | Isolate pool. |
| `pool_contexts` | Active context count relative to configured context pool limits. | Context pool. |
| `fd` | Open file descriptors relative to the process FD limit (`ulimit -n`). | Egress connection manager. |

### Thresholds

| Level | Score range | Meaning |
|---|---|---|
| `normal` | 0.00 -- 0.74 | Operating within expected capacity. |
| `warning` | 0.75 -- 0.89 | Approaching saturation. Consider scaling proactively. |
| `critical` | 0.90 -- 1.00 | At or near capacity. `should_scale_out` is `true`. |

---

## Using the saturation signal

### Kubernetes HPA

Expose the saturation score as a custom metric and configure a Horizontal Pod Autoscaler:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: thunder
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: thunder
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Pods
      pods:
        metric:
          name: thunder_process_saturation_score
        target:
          type: AverageValue
          averageValue: "0.7"
```

### Custom autoscaler

Poll the metrics endpoint and act on the signal:

```bash
curl -s http://localhost:9001/_internal/metrics | \
  jq '.process_saturation'
```

```json
{
  "score": 0.62,
  "level": "normal",
  "should_scale_out": false,
  "components": {
    "memory": 0.45,
    "cpu": 0.30,
    "pool_isolates": 0.78,
    "pool_contexts": 0.55,
    "fd": 0.40
  }
}
```

Scale out when `should_scale_out` is `true` or when the score consistently exceeds 0.75.

---

## Isolate pool configuration

The isolate pool manages V8 isolate lifecycles. Pool sizing directly affects cold-start latency and memory consumption.

| Flag | Env var | Default | Description |
|---|---|---|---|
| `--pool-enabled` | `EDGE_RUNTIME_POOL_ENABLED` | `true` | Enable isolate pooling. When disabled, every request creates and destroys a fresh isolate. |
| `--pool-global-max-isolates` | `EDGE_RUNTIME_POOL_GLOBAL_MAX_ISOLATES` | `256` | Hard cap on live isolates across all functions. |
| `--pool-min-free-memory-mib` | `EDGE_RUNTIME_POOL_MIN_FREE_MEMORY_MIB` | None | Floor for free system memory. The pool evicts idle isolates to stay above this threshold. |

### Behaviour

- When a request arrives for a function with a warm isolate in the pool, it is served immediately (hot path).
- When no warm isolate is available, a new one is created (cold start).
- When the pool is at `pool-global-max-isolates`, the least-recently-used idle isolate is evicted to make room.
- When `pool-min-free-memory-mib` is set and free memory drops below the threshold, idle isolates are evicted regardless of the max count.

---

## Context pool configuration

Within a single isolate, Thunder can optionally reuse V8 contexts to amortise setup cost across requests.

| Flag | Env var | Default | Description |
|---|---|---|---|
| `--context-pool-enabled` | `EDGE_RUNTIME_CONTEXT_POOL_ENABLED` | `false` | Enable context pooling within isolates. |
| `--max-contexts-per-isolate` | `EDGE_RUNTIME_MAX_CONTEXTS_PER_ISOLATE` | `10` | Maximum V8 contexts per isolate. |
| `--max-active-requests-per-context` | `EDGE_RUNTIME_MAX_ACTIVE_REQUESTS_PER_CONTEXT` | `1` | Maximum concurrent requests per context. |

Context pooling is most useful for functions with expensive module-level initialisation (large dependency trees, heavy startup computation). It allows multiple requests to share the module-level state while maintaining request-level isolation at the context boundary.

---

## Egress connection manager

Thunder manages outbound connections (from `fetch()`, WebSocket, `node:net`, etc.) through an egress connection manager that tracks file descriptor usage.

### FD budget

The FD budget is computed as:

```
available_fds = ulimit_n - reserved_fds - ingress_fds
```

Where:

- `ulimit_n` is the process file descriptor limit.
- `reserved_fds` is a safety margin for internal use (logs, OTEL, etc.).
- `ingress_fds` is the current number of inbound connections.

When the available FD budget is exhausted, outbound connection attempts are queued until FDs are released.

### Monitoring

The `fd` component of the saturation signal reflects FD utilisation. If this component consistently approaches 1.0, consider:

- Increasing the process FD limit (`ulimit -n`).
- Reducing the number of concurrent outbound connections per function.
- Scaling out to additional Thunder instances.

---

## Listener connection capacity

The ingress listener caps concurrent connections at `--max-connections`. This value is also clamped to the process FD limit to prevent the listener from consuming all available file descriptors.

```
effective_max_connections = min(max_connections, ulimit_n - reserved_fds)
```

If the configured `--max-connections` exceeds the FD limit, Thunder logs a warning at startup and uses the clamped value.

---

## Scaling recommendations

| Scenario | Approach |
|---|---|
| Steady traffic growth | Scale horizontally. Add Thunder instances behind a load balancer. |
| Bursty traffic | Use `pool-global-max-isolates` headroom and scale on the saturation signal. |
| Many distinct functions | Increase `pool-global-max-isolates`. Monitor cold-start rates. |
| Few functions, high concurrency | Enable context pooling to maximise throughput per isolate. |
| Memory pressure | Set `pool-min-free-memory-mib` to trigger automatic eviction. |
| FD exhaustion | Increase `ulimit -n` or scale out to distribute connections. |
