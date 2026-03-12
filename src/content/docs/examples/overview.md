---
title: "Examples"
description: "Thunder ships with 30 example edge functions covering common patterns from hello-world to WebAssembly."
---

Thunder includes 30 ready-to-run example edge functions in the `examples/` directory of the repository. Each example lives in its own subdirectory with a single TypeScript entry file.

## Running examples

Start any example with the `watch` command, which reloads automatically on file changes:

```bash
thunder watch --path ./examples/hello/hello.ts
```

Or serve all examples and switch between them by path:

```bash
thunder watch --path ./examples
```

## Example catalog

| Example | Directory | Description |
|---|---|---|
| **hello** | `examples/hello/` | Basic hello world -- the simplest possible edge function. |
| **json-api** | `examples/json-api/` | REST API with JSON routes (`GET /api/users`, `POST /api/echo`). |
| **restful-default** | `examples/restful-default/` | RESTful CRUD using `export default` object pattern with `thunder:http` helpers. |
| **all-methods-default** | `examples/all-methods-default/` | Default function handler with `GenericResponse` supporting all HTTP methods. |
| **basic-auth** | `examples/basic-auth/` | HTTP Basic Authentication with timing-safe credential comparison. |
| **cors** | `examples/cors/` | CORS handling with configurable allowed origins, methods, and headers. |
| **websocket** | `examples/websocket/` | WebSocket server with echo and greeting logic. |
| **server-sent-events** | `examples/server-sent-events/` | SSE streaming using `ReadableStream` with typed events. |
| **streaming-data** | `examples/streaming-data/` | Chunked response streaming with `ReadableStream`. |
| **caching** | `examples/caching/` | Cache-Control headers and conditional request handling. |
| **compression-stream** | `examples/compression-stream/` | Gzip and deflate compression using `CompressionStream` / `DecompressionStream`. |
| **form-handling** | `examples/form-handling/` | `FormData` processing for multipart and URL-encoded forms. |
| **middleware** | `examples/middleware/` | Request/response middleware pattern (logging, auth, timing). |
| **rate-limiting** | `examples/rate-limiting/` | In-memory rate limiting with sliding window. |
| **security-headers** | `examples/security-headers/` | Security header configuration (CSP, HSTS, X-Frame-Options, etc.). |
| **url-redirect** | `examples/url-redirect/` | URL redirection with status code control. |
| **urlpattern-routing** | `examples/urlpattern-routing/` | `URLPattern`-based routing for clean path matching. |
| **web-crypto-api** | `examples/web-crypto-api/` | Web Crypto API usage (hashing, signing, encryption). |
| **wasm** | `examples/wasm/` | WebAssembly module loading and execution (Fibonacci calculator). |
| **preact-ssr** | `examples/preact-ssr/` | Server-side rendering with Preact-style components. |
| **html-page** | `examples/html-page/` | Serve a full HTML page from an edge function. |
| **http-request** | `examples/http-request/` | Outbound HTTP requests using `fetch()`. |
| **error-handling** | `examples/error-handling/` | Error handling patterns and structured error responses. |
| **abort-controller** | `examples/abort-controller/` | `AbortController` for request cancellation and timeouts. |
| **data-processing** | `examples/data-processing/` | Data transformation and processing pipelines. |
| **generators** | `examples/generators/` | Generator functions and async iterators. |
| **intl-api** | `examples/intl-api/` | Internationalization API (`Intl.DateTimeFormat`, `Intl.NumberFormat`). |
| **performance-api** | `examples/performance-api/` | `Performance` API for timing measurements. |
| **request-modification** | `examples/request-modification/` | Request cloning and header modification. |
| **transform-stream** | `examples/transform-stream/` | `TransformStream` for on-the-fly data transformation. |

## Bundling an example

You can bundle any example into a deployable artifact:

```bash
thunder bundle --entrypoint ./examples/hello/hello.ts --output ./hello.eszip
```

Or as a snapshot bundle:

```bash
thunder bundle --entrypoint ./examples/hello/hello.ts --output ./hello.snapshot.bundle --format snapshot
```

See the individual example pages for more details on [Hello World](/docs/examples/hello-world/), [JSON API](/docs/examples/json-api/), [RESTful CRUD](/docs/examples/restful-crud/), and [more](/docs/examples/more/).
