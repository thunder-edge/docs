---
title: "More Examples"
---

Beyond the core examples covered in previous pages, Thunder ships with many more edge functions that demonstrate specific Web APIs and patterns. All examples are in the `examples/` directory of the repository and can be run with `thunder watch --path ./examples/<name>/<name>.ts`.

## WebSocket

**Directory:** `examples/websocket/`

Upgrades an HTTP connection to WebSocket using `Deno.upgradeWebSocket()`. The server echoes back every message and responds to greetings.

```typescript
export default function handler(req: Request) {
  const { socket, response } = Deno.upgradeWebSocket(req);

  socket.onmessage = (event) => {
    const message = event.data;
    socket.send(
      JSON.stringify({
        type: "echo",
        message,
        receivedAt: new Date().toISOString(),
      })
    );
  };

  return response;
}
```

**Limits:** Thunder enforces a maximum of 128 concurrent WebSocket connections per isolate and a 30-second idle timeout per socket.

## Server-Sent Events (SSE)

**Directory:** `examples/server-sent-events/`

Streams events from server to client using a `ReadableStream` with `text/event-stream` content type. Each event is formatted as `event: <type>\ndata: <json>\n\n`.

```typescript
import { StreamResponse } from "thunder:http";

export default function handler(req: Request) {
  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const msg = `event: update\ndata: ${JSON.stringify({ counter: i + 1 })}\n\n`;
        controller.enqueue(msg);
      }
      controller.close();
    },
  });

  return StreamResponse(stream)
    .header("content-type", "text/event-stream")
    .header("cache-control", "no-cache")
    .toResponse();
}
```

SSE is unidirectional (server to client) and works over standard HTTP, making it simpler than WebSocket for push-only use cases.

## WebAssembly

**Directory:** `examples/wasm/`

Loads a WebAssembly module (a Fibonacci calculator compiled from WAT) and calls its exported function from JavaScript.

```typescript
import { JSONResponse } from "thunder:http";

const wasmCode = new Uint8Array([/* ... wasm bytes ... */]);

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const n = parseInt(url.searchParams.get("n") || "5");

  const wasmModule = await WebAssembly.instantiate(wasmCode);
  const fibonacci = wasmModule.instance.exports.fibonacci as (n: number) => number;
  const result = fibonacci(n);

  return JSONResponse({ function: "fibonacci", input: n, result }).toResponse();
}
```

In production, you would compile the WASM module from Rust, C, or AssemblyScript rather than embedding raw bytes.

## Preact SSR

**Directory:** `examples/preact-ssr/`

Server-side rendering with Preact-style components. The example defines simple component functions (`Card`, `Layout`, `Button`) that return HTML strings, composed into a full page and served with `text/html`.

This pattern works without external dependencies -- no `npm install` required. For production SSR, you would import `preact-render-to-string` from an eszip bundle.

## Basic Auth

**Directory:** `examples/basic-auth/`

Parses the `Authorization: Basic <base64>` header, decodes credentials, and performs a timing-safe comparison using `crypto.subtle.sign("HMAC", ...)` to prevent timing attacks.

```typescript
// Decode credentials
const credentials = atob(authHeader.slice(6));
const [username, password] = credentials.split(":");

// Timing-safe comparison via HMAC
const key = await crypto.subtle.importKey(
  "raw", new Uint8Array(32),
  { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
);
const sig1 = await crypto.subtle.sign("HMAC", key, encoder.encode(username));
const sig2 = await crypto.subtle.sign("HMAC", key, encoder.encode(VALID_USERNAME));
// Compare byte-by-byte with constant-time XOR
```

Public routes (`/health`, `/login`) bypass authentication.

## CORS

**Directory:** `examples/cors/`

Demonstrates configurable Cross-Origin Resource Sharing with:

- An allowlist of origins (`http://localhost:3000`, `https://example.com`, etc.).
- Preflight `OPTIONS` handling that returns `204 No Content` with the required headers.
- `access-control-allow-credentials: true` for cookie-based flows.
- `access-control-max-age: 3600` to cache preflight responses.

The CORS headers are added via a helper function that inspects the request's `Origin` header against the allowlist.

## Compression

**Directory:** `examples/compression-stream/`

Uses the Web Streams `CompressionStream` and `DecompressionStream` APIs to compress and decompress data with gzip or deflate.

```typescript
// Compress
const compressed = ReadableStream.from([input])
  .pipeThrough(new CompressionStream("gzip"));

// Decompress
const decompressed = ReadableStream.from([compressed])
  .pipeThrough(new DecompressionStream("gzip"));
```

The example exposes `POST /api/compress` and `POST /api/decompress` endpoints that report original size, compressed size, and compression ratio.

## Additional examples

The following examples are also available in the repository:

| Example | What it demonstrates |
|---|---|
| **abort-controller** | `AbortController` for request cancellation and fetch timeouts. |
| **caching** | `Cache-Control`, `ETag`, and conditional `304 Not Modified` responses. |
| **data-processing** | Array/object transformation pipelines. |
| **error-handling** | Structured error responses with stack traces in development mode. |
| **form-handling** | `FormData` parsing for `multipart/form-data` and `application/x-www-form-urlencoded`. |
| **generators** | Generator functions and async iterators for streaming data. |
| **html-page** | Serving a complete HTML page with inline CSS and JS. |
| **http-request** | Outbound `fetch()` calls to external APIs. |
| **intl-api** | `Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.Collator`. |
| **middleware** | Request/response middleware chain (logging, auth, timing). |
| **performance-api** | `performance.now()` and `performance.mark()` for timing. |
| **rate-limiting** | In-memory sliding-window rate limiter. |
| **request-modification** | Cloning requests and modifying headers before forwarding. |
| **security-headers** | CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy. |
| **transform-stream** | `TransformStream` for on-the-fly data transformation. |
| **url-redirect** | 301/302 redirects with `Response.redirect()`. |
| **urlpattern-routing** | `URLPattern` API for declarative route matching. |
| **web-crypto-api** | Hashing (SHA-256), HMAC signing, AES encryption/decryption. |

Browse the full source in `examples/` or see the [Examples overview](/examples/overview/) for the complete catalog.
