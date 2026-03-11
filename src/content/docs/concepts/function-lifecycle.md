---
title: "Function Lifecycle"
---

Every edge function in Thunder follows a defined lifecycle from deployment to execution to teardown. Understanding this lifecycle helps you write functions that start fast, run efficiently, and clean up properly.

## Function States

A function transitions through the following states:

```
loading  -->  running  -->  shutting_down
   |                            |
   +------->  error  <----------+
```

**loading** -- The isolate is being created: V8 initializes, the ESZIP bundle (or snapshot) is loaded, and the function module is evaluated. Any top-level code runs during this phase.

**running** -- The function is ready to handle incoming requests. New requests are dispatched to the isolate (or one of its pool members).

**shutting_down** -- The function has been deleted or the runtime is shutting down. In-flight requests are drained before the isolate is destroyed.

**error** -- The function failed to load (syntax error, uncaught exception during module evaluation, resource limit exceeded). The function cannot serve requests until it is redeployed.

---

## Deployment Flow

Deploying a function involves three steps: bundle, upload, and start.

```
Bundle            Upload             Start
 .ts/.js  --->  Admin API  --->  FunctionRegistry  --->  Isolate created
                POST /_internal/functions                 State: running
```

1. **Bundle** -- Use `thunder bundle` to package the entrypoint and its dependencies into an ESZIP (or snapshot) artifact.

2. **Upload** -- Send the artifact to the admin API at `POST /_internal/functions` with an `x-function-name` header. The runtime validates the bundle, checks the optional manifest, and verifies the optional Ed25519 signature.

3. **Registry** -- The `FunctionRegistry` stores the function metadata and creates one or more isolates according to pool configuration. The function transitions to `running` and begins serving requests on the ingress listener at `/{function_name}/*`.

Updates follow the same flow via `PUT /_internal/functions/{name}`. The existing isolate is replaced after the new one loads successfully.

---

## Cold Start vs. Warm Start

### Cold Start

The first request to a function (or the first request after the isolate has been recycled) triggers a cold start:

1. A new V8 isolate is created.
2. The ESZIP bundle is deserialized (or the V8 snapshot is restored).
3. The function module is evaluated (top-level code runs).
4. The request is dispatched to the handler.

Cold starts are the most expensive part of function execution. Using the snapshot bundle format reduces cold-start time by restoring a pre-initialized V8 heap instead of parsing and evaluating JavaScript from scratch.

### Warm Start

Subsequent requests reuse the existing isolate. The module is already evaluated, globals are in place, and only the handler function runs. Warm starts are significantly faster than cold starts.

```
Cold start:   Create isolate -> Load bundle -> Evaluate module -> Handle request
Warm start:   Handle request
```

---

## Isolate Pool

Thunder can maintain multiple isolates per function and enforce global limits across all functions.

### Per-Function Pool

When isolate pooling is enabled (`--pool-enabled`), each function can have configurable pool bounds:

- **min** -- Minimum number of warm isolates kept alive (pre-warmed for low-latency).
- **max** -- Maximum number of isolates that can be created for a single function.

Pool limits can be read and updated at runtime:

```
GET  /_internal/functions/{name}/pool
PUT  /_internal/functions/{name}/pool   {"min": 2, "max": 10}
```

### Global Cap

The `--pool-global-max-isolates` flag (default: 256) sets the maximum total isolates across all functions in the process. This prevents a single busy function from exhausting host memory at the expense of other functions.

The `--pool-min-free-memory-mib` flag (default: 256 MiB) blocks isolate creation when system free memory falls below the threshold.

---

## Per-Request Resource Tracking

Each incoming request receives a unique execution ID. The runtime tracks all resources created during that request:

| Resource | Tracking |
|----------|----------|
| `setTimeout` | Timer ID registered to execution ID. |
| `setInterval` | Interval ID registered to execution ID. |
| `fetch()` | Wrapped with an `AbortController` tied to execution ID. |
| Promises | Tracked via promise registry per execution ID. |

When a request completes normally, resources are cleaned up by the function's own code (clearing timers, awaiting promises). When a request times out, the runtime performs automatic cleanup:

1. All timers and intervals for the execution ID are cleared.
2. All `AbortController` instances are aborted, canceling in-flight `fetch()` calls.
3. All tracked promises are rejected.
4. The V8 termination flag is reset, and the isolate is returned to service.

This ensures that a timed-out request does not leave dangling resources that affect subsequent requests in the same isolate.

---

## Timeout and Cleanup

When a request exceeds the wall-clock timeout:

```
Client              Isolate Thread        Watchdog Thread
  |                       |                     |
  |-- HTTP Request ------>|                     |
  |                       |-- spawn ----------->|
  |                       |                     |
  |                       |   (JS executing)    |-- waiting...
  |                       |                     |
  |                       |                     |-- deadline reached
  |                       |<-- terminate -------|
  |                       |                     |
  |                       |-- cancel terminate  |
  |                       |-- clear resources   |
  |                       |                     |
  |<-- 504 Timeout -------|                     |
```

The watchdog thread monitors elapsed time. When the deadline is reached, it calls `terminate_execution()` on the V8 isolate, which interrupts JavaScript execution immediately. The isolate thread then clears tracked resources, resets the termination flag, and returns a 504 response to the client.

After cleanup, the isolate is reusable. Subsequent requests execute normally.

---

## Lifecycle Summary

| Phase | What Happens | Configuration |
|-------|-------------|---------------|
| Bundle | Code and dependencies packaged into ESZIP or snapshot. | `thunder bundle --format eszip\|snapshot` |
| Deploy | Artifact uploaded to admin API, validated, stored in registry. | `POST /_internal/functions` |
| Cold start | Isolate created, module evaluated, first request served. | `--max-heap-mib`, snapshot format |
| Warm start | Existing isolate handles request directly. | (automatic) |
| Timeout | Watchdog terminates execution, resources cleaned up, isolate reused. | `--wall-clock-timeout-ms`, `--cpu-time-limit-ms` |
| Shutdown | In-flight requests drained, isolate destroyed. | `--graceful-exit-timeout` |
