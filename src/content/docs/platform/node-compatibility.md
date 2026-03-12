---
title: "Node.js Compatibility"
description: "Node.js module polyfills available in the Thunder edge runtime."
---

Thunder ships **42 `node:*` module polyfills** so that npm packages and Node-oriented code can run at the edge without modification. Each module falls into one of three compatibility levels.

## Compatibility levels

| Level | Meaning |
|---|---|
| **Full** | The module behaves the same as in Node.js for all common use cases. |
| **Partial** | Core functionality works; some advanced or rarely used APIs may be missing or differ. |
| **Stub** | The module can be imported without error, but calling its APIs throws a descriptive error at runtime. |

Stub modules exist so that transitive dependencies that merely _import_ a module (without calling it on the hot path) do not crash at load time.

### Stub error format

When a stubbed API is called, Thunder throws:

```
[thunder] <api> is not implemented in this runtime profile
```

For example, `require("child_process").spawn(...)` throws:

```
[thunder] child_process.spawn is not implemented in this runtime profile
```

---

## Module reference

### Partial support

These modules provide working implementations for the most common operations. Check the **Notes** column for specifics.

| Module | Level | Notes |
|---|---|---|
| `node:assert` | Partial | `assert`, `assert.ok`, `assert.strictEqual`, `assert.deepStrictEqual`, `assert.throws`, and friends. |
| `node:async_hooks` | Partial | `AsyncLocalStorage` works. `AsyncResource` is available. `createHook` is a no-op. |
| `node:buffer` | Partial | `Buffer.from`, `Buffer.alloc`, `Buffer.concat`, `toString` encodings. Most methods present. |
| `node:console` | Partial | Delegates to the global `console`. Matches standard methods. |
| `node:crypto` | Partial | `randomBytes`, `randomUUID`, `createHash` (sha1, sha256, sha384, sha512, md5), `createHmac`, `timingSafeEqual`, `pbkdf2`, `scrypt`. No cipher streams. |
| `node:diagnostics_channel` | Partial | `channel()`, `subscribe()`, `unsubscribe()`. No TracingChannel. |
| `node:dns` | Partial | `lookup`, `resolve4`, `resolve6`, `resolveTxt`, `resolveMx` backed by DNS-over-HTTPS (DoH). |
| `node:events` | Partial | `EventEmitter`, `once`, `on`. `captureRejections` supported. |
| `node:fs` | Partial | VFS-backed. `readFileSync`, `writeFileSync`, `mkdirSync`, `readdirSync`, `statSync`, `existsSync`, `unlinkSync`, `renameSync`. Async variants delegate to sync under the hood. See [Virtual File System](/docs/platform/vfs/). |
| `node:fs/promises` | Partial | Promise wrappers around VFS-backed sync operations. |
| `node:http` | Partial | `createServer` is not available (the runtime is the server). `request` and `get` for outbound calls work. |
| `node:https` | Partial | Same as `node:http` with TLS. |
| `node:module` | Partial | `createRequire` works for CJS interop. |
| `node:net` | Partial | Outbound `Socket` and `connect` for TCP. No `createServer`. |
| `node:os` | Partial | `platform`, `arch`, `tmpdir`, `EOL`, `homedir`. Values reflect the runtime sandbox, not the host. |
| `node:path` | Partial | Full `posix` implementation. `win32` methods are present but always use posix semantics. |
| `node:perf_hooks` | Partial | `performance.now()`, `PerformanceObserver`. |
| `node:process` | Partial | `env`, `cwd()`, `nextTick`, `hrtime`, `hrtime.bigint`, `platform`, `arch`, `version`, `exit` (terminates the isolate). |
| `node:punycode` | Partial | `encode`, `decode`, `toASCII`, `toUnicode`. |
| `node:querystring` | Partial | `parse`, `stringify`, `escape`, `unescape`. |
| `node:stream` | Partial | `Readable`, `Writable`, `Duplex`, `Transform`, `PassThrough`, `pipeline`, `finished`. Web-stream interop. |
| `node:string_decoder` | Partial | UTF-8, UTF-16LE, Base64, Latin1. |
| `node:timers` | Partial | `setTimeout`, `setInterval`, `setImmediate`, `clearTimeout`, `clearInterval`, `clearImmediate`. |
| `node:timers/promises` | Partial | `setTimeout`, `setInterval`, `setImmediate` returning promises. |
| `node:tls` | Partial | Outbound `connect`. No `createServer`. |
| `node:url` | Partial | WHATWG `URL` and legacy `url.parse`, `url.format`, `url.resolve`. |
| `node:util` | Partial | `promisify`, `callbackify`, `inspect`, `format`, `types`, `TextEncoder`, `TextDecoder`. |
| `node:v8` | Partial | `getHeapStatistics` returns current isolate heap stats. Serializer/Deserializer are stubs. |
| `node:zlib` | Partial | `gzip`, `gunzip`, `deflate`, `inflate`, `brotliCompress`, `brotliDecompress`. Backed by native Rust ops for performance. |

### Stub only

These modules can be imported but all exported functions throw at call time.

| Module | Level | Notes |
|---|---|---|
| `node:child_process` | Stub | Process spawning is not allowed in the sandbox. |
| `node:cluster` | Stub | Multi-process clustering is managed by the runtime, not user code. |
| `node:dgram` | Stub | UDP sockets are not available. |
| `node:http2` | Stub | HTTP/2 client/server APIs are not exposed; the runtime handles HTTP/2 at the listener level. |
| `node:inspector` | Stub | V8 inspector protocol is not exposed to user code. |
| `node:readline` | Stub | No interactive terminal in edge functions. |
| `node:repl` | Stub | No interactive REPL in edge functions. |
| `node:sqlite` | Stub | No embedded database. |
| `node:test` | Stub | Node test runner is not available. Use external test frameworks. |
| `node:vm` | Stub | Nested V8 contexts are not permitted. |
| `node:worker_threads` | Stub | Parallelism is managed by the isolate pool, not user-level threads. |

---

## Notable implementations

### crypto

The `node:crypto` polyfill covers the most common hashing and HMAC operations without pulling in a JavaScript-based fallback. Under the hood it delegates to Deno's native crypto ops, which use ring/rustls.

```js
import { createHash, createHmac, randomBytes } from "node:crypto";

const hash = createHash("sha256").update("hello").digest("hex");
const hmac = createHmac("sha256", "secret").update("data").digest("base64");
const bytes = randomBytes(32);
```

### fs (VFS-backed)

File system operations are backed by the [Virtual File System](/docs/platform/vfs/). `/bundle` is mounted read-only from the deployed function bundle; `/tmp` is writable with quota enforcement.

```js
import { readFileSync, writeFileSync } from "node:fs";

const config = readFileSync("/bundle/config.json", "utf-8");
writeFileSync("/tmp/cache.json", JSON.stringify({ ts: Date.now() }));
```

### dns (DoH-backed)

DNS resolution uses DNS-over-HTTPS rather than system resolvers. This avoids depending on host `/etc/resolv.conf` and works consistently across deployment environments. The DoH endpoint is configurable via `--dns-doh-endpoint`.

```js
import { promises as dns } from "node:dns";

const addresses = await dns.resolve4("example.com");
```

### zlib (native Rust ops)

Compression and decompression are handled by native Rust operations, providing significantly better throughput than pure-JavaScript implementations.

```js
import { gzipSync, gunzipSync } from "node:zlib";

const compressed = gzipSync(Buffer.from("hello world"));
const original = gunzipSync(compressed).toString();
```

---

## Import syntax

Both ESM and CJS-style imports are supported:

```js
// ESM
import { readFileSync } from "node:fs";
import crypto from "node:crypto";

// CJS (via createRequire or bundler transform)
const fs = require("node:fs");
```

The `node:` prefix is required. Bare specifiers like `require("fs")` are rewritten to `node:fs` by the module loader.
