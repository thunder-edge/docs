---
title: "Virtual File System"
description: "Sandboxed in-memory file system for node:fs compatibility in Thunder."
---

Thunder provides a **sandboxed, in-memory Virtual File System (VFS)** so that code using `node:fs` works without access to the host file system. The VFS is scoped to each isolate and is completely ephemeral -- all data is lost when the isolate is recycled.

## Mount points

| Path | Mode | Source | Purpose |
|---|---|---|---|
| `/bundle` | Read-only | Deployed function bundle | Application code, static assets, configuration files packaged with the function. |
| `/tmp` | Read-write | Empty at startup | Scratch space for caches, temporary files, intermediate data. Quota-enforced. |
| `/dev/null` | Write-only | Sink | Discards all writes. Reads return EOF. |

Any path outside these mount points returns `ENOENT`.

---

## Quotas

Writable space under `/tmp` is constrained by two quotas to prevent a single function from exhausting isolate memory.

| Parameter | Default | CLI flag | Env var |
|---|---|---|---|
| Total writable bytes | 10 MiB | `--vfs-total-quota-bytes` | `EDGE_RUNTIME_VFS_TOTAL_QUOTA_BYTES` |
| Max single file bytes | 5 MiB | `--vfs-max-file-bytes` | `EDGE_RUNTIME_VFS_MAX_FILE_BYTES` |

When a write would exceed either limit, the operation fails with `ENOSPC`.

```js
import { writeFileSync } from "node:fs";

// This succeeds if within quota
writeFileSync("/tmp/data.json", JSON.stringify(payload));

// This throws ENOSPC if the file exceeds vfsMaxFileBytes
try {
  writeFileSync("/tmp/large.bin", hugeBuffer);
} catch (err) {
  console.error(err.code); // "ENOSPC"
}
```

---

## Supported operations

### Read operations

| Function | Sync | Async | Notes |
|---|---|---|---|
| `readFileSync` / `readFile` | Yes | Yes | Returns `Buffer` or string depending on encoding option. |
| `readdirSync` / `readdir` | Yes | Yes | Returns file and directory names. Supports `withFileTypes`. |
| `statSync` / `stat` | Yes | Yes | Returns size, mtime, isFile, isDirectory. |
| `lstatSync` / `lstat` | Yes | Yes | Same as stat (no symlinks in VFS). |
| `existsSync` | Yes | -- | Returns boolean. |
| `accessSync` / `access` | Yes | Yes | Checks existence and permissions. |
| `readlinkSync` / `readlink` | Yes | Yes | Always throws `EOPNOTSUPP` (no symlinks). |

### Write operations (only under `/tmp`)

| Function | Sync | Async | Notes |
|---|---|---|---|
| `writeFileSync` / `writeFile` | Yes | Yes | Creates or overwrites a file. Enforces quotas. |
| `appendFileSync` / `appendFile` | Yes | Yes | Appends to a file. Enforces quotas. |
| `mkdirSync` / `mkdir` | Yes | Yes | Creates directories. Supports `recursive`. |
| `unlinkSync` / `unlink` | Yes | Yes | Removes a file. Frees quota. |
| `rmdirSync` / `rmdir` | Yes | Yes | Removes an empty directory. |
| `rmSync` / `rm` | Yes | Yes | Supports `recursive` and `force`. |
| `renameSync` / `rename` | Yes | Yes | Moves/renames within `/tmp`. |
| `copyFileSync` / `copyFile` | Yes | Yes | Copies within or into `/tmp`. Enforces quotas. |

### Not supported

These operations are intentionally not available:

- Symlinks (`symlink`, `link`)
- File permissions (`chmod`, `chown`)
- File watchers (`watch`, `watchFile`)
- File descriptors (`open`, `read`, `write`, `close` -- low-level fd API)
- Streams (`createReadStream`, `createWriteStream`)

Calling unsupported operations throws with code `EOPNOTSUPP`.

---

## Error model

The VFS uses standard Node.js `SystemError` codes:

| Code | Meaning |
|---|---|
| `ENOENT` | File or directory not found. |
| `ENOTDIR` | A component of the path is not a directory. |
| `EISDIR` | Expected a file but found a directory. |
| `EROFS` | Write attempted on a read-only mount (`/bundle`). |
| `ENOSPC` | Write would exceed VFS quota. |
| `EOPNOTSUPP` | Operation is not supported by the VFS. |

Error objects include `code`, `syscall`, `path`, and `message` fields, matching the Node.js convention.

---

## Configuration

### Bundle resources

Files are mounted under `/bundle` from the function manifest. When deploying a function, include static assets in the bundle directory and they will be available at `/bundle/<relative-path>`.

```js
// Read a config file shipped with the function
import { readFileSync } from "node:fs";
const config = JSON.parse(readFileSync("/bundle/config.json", "utf-8"));
```

### CLI flags

```
--vfs-total-quota-bytes <bytes>    Total writable bytes across /tmp (default: 10485760)
--vfs-max-file-bytes <bytes>       Maximum size of a single file in /tmp (default: 5242880)
```

### Environment variables

```
EDGE_RUNTIME_VFS_TOTAL_QUOTA_BYTES=10485760
EDGE_RUNTIME_VFS_MAX_FILE_BYTES=5242880
```

---

## Lifecycle

1. **Isolate creation** -- The VFS is initialised. `/bundle` is populated from the function manifest. `/tmp` is empty.
2. **Request handling** -- Code may read from `/bundle` and read/write to `/tmp`. Quota is tracked.
3. **Isolate recycle** -- All VFS state is discarded. No data persists across isolate lifetimes.

Because `/tmp` is purely in-memory and ephemeral, it should only be used for transient data such as caches or intermediate computation artifacts. Never rely on `/tmp` for durable storage.
