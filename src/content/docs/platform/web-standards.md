---
title: "Web Standards Support"
description: "Web API compatibility in the Thunder edge runtime."
---

Thunder aims for broad Web Standards compliance. Functions deployed to the runtime can use the same APIs they would use in a modern browser or in Cloudflare Workers, with the obvious exception of DOM and browser-only surfaces.

## Compatibility summary

| Category | Count | Percentage |
|---|---|---|
| **Full** | 62 / 81 | 77% |
| **Partial** | 3 / 81 | 4% |
| **None** | 16 / 81 | 20% |

---

## Fully supported APIs

The following APIs are available with full spec-level behaviour.

### Fetch and networking

| API | Notes |
|---|---|
| `fetch()` | HTTP/1.1 and HTTP/2. Respects egress proxy settings. |
| `Request` | All standard constructors and methods. |
| `Response` | Includes `Response.json()`, `Response.redirect()`. |
| `Headers` | Iterable. Case-insensitive. |
| `WebSocket` | Client-side `new WebSocket(url)` with per-isolate connection limit. |

### URL

| API | Notes |
|---|---|
| `URL` | WHATWG URL spec. |
| `URLSearchParams` | Full iteration and mutation support. |
| `URLPattern` | Pattern matching for URL routing. |

### Encoding and serialisation

| API | Notes |
|---|---|
| `TextEncoder` | UTF-8 encoding. |
| `TextDecoder` | UTF-8, UTF-16, and legacy encodings. |
| `atob()` / `btoa()` | Base-64 encode and decode. |
| `structuredClone()` | Deep clone of structured-cloneable values. |

### Cryptography

| API | Notes |
|---|---|
| `crypto` | Global `crypto.getRandomValues()` and `crypto.randomUUID()`. |
| `CryptoKey` | Key objects for use with SubtleCrypto. |
| `SubtleCrypto` | `crypto.subtle` -- digest, sign, verify, encrypt, decrypt, key generation. |

### Streams

| API | Notes |
|---|---|
| `ReadableStream` | Including `ReadableStream.from()` and async iteration. |
| `WritableStream` | Backpressure-aware writes. |
| `TransformStream` | Pipeable transform chains. |
| `CompressionStream` | `gzip`, `deflate`, `deflate-raw`. |
| `DecompressionStream` | `gzip`, `deflate`, `deflate-raw`. |

### Binary data and forms

| API | Notes |
|---|---|
| `Blob` | Immutable binary data. |
| `File` | Extends `Blob` with `name` and `lastModified`. |
| `FormData` | Multipart form construction and parsing. |

### Scheduling and lifecycle

| API | Notes |
|---|---|
| `setTimeout()` / `clearTimeout()` | Timer scheduling within wall-clock budget. |
| `setInterval()` / `clearInterval()` | Repeating timers within wall-clock budget. |
| `queueMicrotask()` | Microtask queue scheduling. |
| `AbortController` | Create abort signals. |
| `AbortSignal` | Signal cancellation of async operations. |

### Events

| API | Notes |
|---|---|
| `EventTarget` | `addEventListener`, `removeEventListener`, `dispatchEvent`. |
| `Event` | Base event class. |
| `CustomEvent` | User-defined event payloads. |

### Observability and utilities

| API | Notes |
|---|---|
| `console` | `log`, `warn`, `error`, `info`, `debug`, `time`, `timeEnd`, `timeLog`, `trace`, `assert`, `dir`, `table`. |
| `performance` | `performance.now()` for high-resolution timing. |
| `Intl` | Full ICU-based internationalisation (number, date, collation, pluralisation). |

---

## Partially supported APIs

| API | Status | Notes |
|---|---|---|
| `navigator` | Partial | `navigator.userAgent` returns the Thunder version string. Other properties are stubs. |
| `caches` | Partial | Cache API interface is present; behaviour is runtime-scoped, not persisted. |
| `MessageChannel` / `MessagePort` | Partial | Usable within a single isolate; cross-isolate messaging is not supported. |

---

## Not available

The following APIs are **not available** in the Thunder runtime. Attempting to access them will result in a `ReferenceError` or a stub that throws.

| API | Reason |
|---|---|
| `document`, `window`, `HTMLElement`, all DOM APIs | No browser rendering engine. |
| `localStorage` / `sessionStorage` | No persistent client-side storage. |
| `IndexedDB` | No persistent client-side storage. |
| `ServiceWorker` | Not applicable to edge function model. |
| `SharedWorker` | Not applicable to edge function model. |
| `Worker` (dedicated) | Use isolate-level concurrency instead. |
| `WebGPU` | No GPU access in edge environment. |
| `WebRTC` | No peer-to-peer media support. |
| `WebTransport` | Not yet implemented. |
| `Notification` | Browser-only API. |
| `Geolocation` | Browser-only API. |
| `Bluetooth` / `USB` / `Serial` / `HID` | Hardware APIs not applicable. |
| `Screen` / `MediaDevices` | Browser-only APIs. |

---

## Feature detection

Use standard feature detection when writing portable code:

```js
if (typeof crypto.subtle !== "undefined") {
  // SubtleCrypto is available
}

if (typeof WebSocket !== "undefined") {
  // WebSocket client is available
}
```

This avoids hard failures when the same bundle is tested in environments with different API surfaces.
