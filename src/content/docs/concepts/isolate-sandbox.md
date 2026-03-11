---
title: "Isolate Sandbox"
---

Every edge function in Thunder runs inside a V8 isolate -- a lightweight, memory-isolated execution environment provided by the V8 JavaScript engine. Isolates are the core security boundary between untrusted function code and the host system.

## V8 Isolates

A V8 isolate is an independent instance of the V8 engine with its own heap, garbage collector, and global scope. Isolates cannot read or write memory belonging to other isolates or the host process. This provides strong isolation without the overhead of full OS-level process separation.

Thunder creates one or more isolates per deployed function (depending on pool configuration). Each isolate executes the function's JavaScript/TypeScript code in a sandbox where the runtime controls exactly which APIs and resources are available.

---

## Security Boundaries

### No Host Filesystem Access

Function code cannot access the host filesystem. Instead, Thunder provides a Virtual File System (VFS) with three mounts:

| Mount | Access | Description |
|-------|--------|-------------|
| `/bundle` | Read-only | Packaged function artifacts from the ESZIP bundle. |
| `/tmp` | Read/write | Ephemeral in-memory storage, subject to quota. |
| `/dev/null` | Write (sink) | Writes are discarded; reads return EOF. |

Attempts to escape the VFS root via `..` traversal are normalized and blocked. Writes outside `/tmp` and `/dev/null` fail with deterministic errors (`EROFS` for `/bundle`, `EOPNOTSUPP` for other paths).

### SSRF Protection

By default, `fetch()` calls from function code are blocked from reaching private IP ranges:

- `127.0.0.0/8` (loopback)
- `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC 1918)
- `169.254.0.0/16` (link-local, cloud metadata endpoints)
- `0.0.0.0/8` (reserved)
- `::1/128`, `fc00::/7`, `fe80::/10` (IPv6 private)

This prevents functions from probing internal services or cloud metadata APIs (such as `http://169.254.169.254/`). Operators can selectively allow specific private subnets with `--allow-private-net` or disable protection entirely for development with `--disable-ssrf-protection`.

### Frozen Globals

The runtime freezes critical global objects before executing function code. This prevents functions from tampering with built-in prototypes or redefining standard APIs in ways that could affect other requests within the same isolate.

---

## Resource Limits

Each isolate is subject to configurable resource limits that prevent runaway functions from consuming unbounded host resources.

### Heap Limit

| Setting | Default | Description |
|---------|---------|-------------|
| `--max-heap-mib` | `128` MiB | Maximum V8 heap size per isolate. |

When a function's heap usage approaches the limit, the isolate is terminated. Setting to `0` disables the limit (not recommended for production).

### CPU Time Limit

| Setting | Default | Description |
|---------|---------|-------------|
| `--cpu-time-limit-ms` | `50000` (50s) | Maximum CPU time per request. |

Measures actual CPU execution time, excluding time spent waiting on I/O. Prevents tight loops and CPU-intensive operations from monopolizing the host.

### Wall-Clock Timeout

| Setting | Default | Description |
|---------|---------|-------------|
| `--wall-clock-timeout-ms` | `60000` (60s) | Maximum elapsed time per request. |

Covers total request duration including network I/O and async waits. When the deadline is reached, V8 execution is terminated by a watchdog thread and all tracked resources (timers, intervals, pending fetches, promises) are cleaned up.

### VFS Quotas

| Setting | Default | Description |
|---------|---------|-------------|
| `--vfs-total-quota-bytes` | `10485760` (10 MiB) | Total writable bytes across all files in `/tmp`. |
| `--vfs-max-file-bytes` | `5242880` (5 MiB) | Maximum size of a single file in `/tmp`. |

Exceeding a quota returns `ENOSPC`.

---

## Virtual File System (VFS)

The VFS is an in-memory filesystem that provides `node:fs` compatibility for packages that expect filesystem APIs.

### Mounts

**`/bundle`** -- Contains read-only artifacts from the deployed ESZIP bundle. Function code can read bundled assets (configuration files, templates, static data) but cannot modify them.

**`/tmp`** -- Writable ephemeral storage. Data exists only for the lifetime of the isolate and is never persisted to the host disk. Subject to the quota limits above.

**`/dev/null`** -- A virtual sink. Useful for discarding output from libraries that require a writable path.

### Supported Operations

The VFS supports synchronous, callback, and promise-based `node:fs` APIs:

- `readFileSync`, `writeFileSync`, `mkdirSync`, `readdirSync`, `statSync`, `existsSync`
- `readFile`, `writeFile`, `mkdir`, `readdir`, `stat`
- Promise variants via `node:fs/promises`

Streaming APIs (`createReadStream`, `createWriteStream`, `watch`) are not supported and fail with `EOPNOTSUPP`.

---

## Isolate Reuse

When a request times out, the isolate is not destroyed. Instead, Thunder performs a soft termination:

1. V8 execution is interrupted via `terminate_execution()`.
2. The termination flag is cleared with `cancel_terminate_execution()`.
3. All resources tracked for the timed-out request (timers, intervals, abort controllers, promises) are cleaned up.
4. The isolate is returned to the pool, ready to serve subsequent requests.

This approach avoids the cold-start cost of creating a new isolate after every timeout while preserving safety through per-request resource tracking.

---

## Configuration Summary

All limits can be set via CLI flags, environment variables, or per-function manifest. Manifest values take precedence over CLI/env, which take precedence over built-in defaults.

| Limit | CLI Flag | Env Variable | Manifest Field |
|-------|----------|-------------|----------------|
| Heap | `--max-heap-mib` | `EDGE_RUNTIME_MAX_HEAP_MIB` | `resources.maxHeapMiB` |
| CPU time | `--cpu-time-limit-ms` | `EDGE_RUNTIME_CPU_TIME_LIMIT_MS` | `resources.cpuTimeMs` |
| Wall clock | `--wall-clock-timeout-ms` | `EDGE_RUNTIME_WALL_CLOCK_TIMEOUT_MS` | `resources.wallClockTimeoutMs` |
| VFS total | `--vfs-total-quota-bytes` | `EDGE_RUNTIME_VFS_TOTAL_QUOTA_BYTES` | `resources.vfsTotalQuotaBytes` |
| VFS per-file | `--vfs-max-file-bytes` | `EDGE_RUNTIME_VFS_MAX_FILE_BYTES` | `resources.vfsMaxFileBytes` |
