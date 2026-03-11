---
title: Key Concepts
description: Core concepts behind the Thunder edge runtime
---

This page defines the core building blocks of Thunder. Understanding these concepts will help you reason about how functions are deployed, executed, and managed.

## Edge Functions

An edge function is a JavaScript or TypeScript module that exports a request handler. It receives a standard `Request` object and must return a `Response` (or a `Promise<Response>`).

Thunder supports three handler patterns:

### 1. `export default function` (preferred for single handlers)

The simplest and recommended way to write an edge function. Export a default function that takes a `Request` and returns a `Response`:

```typescript
export default function handler(req: Request) {
  return new Response("OK");
}
```

### 2. `export default` object with method handlers (preferred for RESTful multi-method)

For endpoints that need to handle multiple HTTP methods, export a default object with named method handlers. Each key corresponds to an HTTP method (`GET`, `POST`, `PUT`, `DELETE`, etc.):

```typescript
import { JSONResponse, HTTP } from "thunder:http";

export default {
  async GET(req: Request) {
    return JSONResponse({ message: "hello" }).toResponse();
  },
  async POST(req: Request) {
    const body = await req.json();
    return JSONResponse(body).status(HTTP.Created).toResponse();
  },
};
```

### 3. `Deno.serve()` (legacy, backwards compatible)

The original handler pattern. Still fully supported for backwards compatibility, but new functions should prefer the `export default` patterns above:

```typescript
Deno.serve((req) => {
  return new Response("OK");
});
```

---

Edge functions are stateless by design. Each invocation gets its own execution context inside a V8 isolate. There is no shared memory between requests handled by different isolates.

## Response Helpers (`thunder:http`)

The `thunder:http` module provides a set of response helpers that simplify building HTTP responses. Each helper returns a builder with `.status()`, `.header()`, `.cookie()`, and `.toResponse()` methods:

- `JSONResponse` -- serialize an object or array as JSON
- `TextResponse` -- plain text response
- `HTMLResponse` -- HTML content response
- `ErrorResponse` -- error response with status code and message
- `EmptyResponse` -- 204 No Content
- `StreamResponse` -- streaming response from a `ReadableStream`
- `RedirectResponse` -- HTTP redirect
- `BinaryResponse` -- binary data response
- `FileResponse` -- file download response
- `BlobResponse` -- blob data response
- `GenericResponse` -- auto-detects the response type: `null` becomes 204, `string` becomes text, `object`/`array` becomes JSON, `ReadableStream` becomes a stream, and a `Response` is passed through unchanged

The `HTTP` status map provides named constants for HTTP status codes (e.g. `HTTP.OK`, `HTTP.Created`, `HTTP.NotFound`).

```typescript
import { JSONResponse, TextResponse, HTTP } from "thunder:http";

export default function handler(req: Request) {
  if (req.method === "POST") {
    return JSONResponse({ created: true }).status(HTTP.Created).toResponse();
  }
  return TextResponse("Hello!").header("x-custom", "value").toResponse();
}
```

## V8 Isolates

A V8 isolate is a lightweight, sandboxed instance of the V8 JavaScript engine. Thunder creates isolates to execute edge functions in complete isolation from each other and from the host system.

Each isolate has its own:

- Heap memory (capped by `--max-heap-mib`)
- CPU time budget (capped by `--cpu-time-limit-ms`)
- Wall-clock timeout (capped by `--wall-clock-timeout-ms`)

If any limit is exceeded, the isolate is terminated and the request receives an error response. Isolates cannot access the host filesystem, environment variables, or other isolates directly.

## ESZIP Bundles

An ESZIP bundle is a single binary file that contains a function's compiled source code along with all of its dependencies. Thunder uses ESZIP as its primary deployment artifact format.

You create a bundle with the CLI:

```bash
thunder bundle --entrypoint ./handler.ts --output ./handler.eszip
```

The bundle step resolves all `import` statements, compiles TypeScript to JavaScript, and packages everything into one portable file. This file is what you upload to the admin API when deploying a function.

## Function Registry

The function registry is an in-memory data structure that maps function names to their deployed bundles and runtime metadata. When you deploy a function via the admin API, it gets registered here. When a request arrives on the ingress listener, the registry is consulted to find the matching function.

The registry supports:

- Adding new functions (`POST /_internal/functions`)
- Updating existing functions (`PUT /_internal/functions/{name}`)
- Removing functions (`DELETE /_internal/functions/{name}`)

Changes to the registry take effect immediately -- no server restart is needed.

## Admin API vs Ingress

Thunder runs two separate HTTP listeners with distinct responsibilities:

**Admin API** (default port `9000`)

The control plane. Used by operators and CI/CD pipelines to manage the runtime. All endpoints are under `/_internal/*` and can be protected with an API key (`--api-key`). Key endpoints:

- `POST /_internal/functions` -- Deploy a new function
- `PUT /_internal/functions/{name}` -- Update an existing function
- `DELETE /_internal/functions/{name}` -- Remove a function
- `GET /_internal/health` -- Health check
- `GET /_internal/metrics` -- Prometheus-format metrics

**Ingress** (default port `8080`)

The data plane. Receives public HTTP traffic and routes it to the appropriate function based on the URL path. A request to `/hello/world` is dispatched to the function named `hello`. No authentication is required.

This separation ensures that management operations never share a port or attack surface with user-facing traffic.

## Isolate Pool

The isolate pool manages the lifecycle of V8 isolates across all deployed functions. Instead of creating and destroying an isolate for every single request, the pool can reuse warm isolates to reduce cold-start latency.

The pool enforces global limits on total isolate count and per-function concurrency. When demand exceeds capacity, requests are queued or rejected based on the configured policy.

## Function Manifest

A function manifest is a JSON document that describes routing rules, metadata, and configuration for a deployed bundle. It is used in advanced deployment scenarios such as routed applications where a single bundle serves multiple URL patterns.

```json
{
  "flavor": "routed-app",
  "routes": [
    { "pattern": "/api/users", "kind": "function", "entrypoint": "users.ts" },
    { "pattern": "/api/posts", "kind": "function", "entrypoint": "posts.ts" }
  ]
}
```

A manifest can be provided explicitly at deploy time via the `x-function-manifest` header or embedded into the bundle at build time with `thunder bundle --manifest`.

## Watch Mode

Watch mode (`thunder watch`) is a development feature that monitors your source files for changes and automatically rebuilds and redeploys the affected functions. It provides a tight edit-save-test loop without manual bundling or deployment steps.

```bash
thunder watch --entrypoint ./handler.ts
```

When a file changes, Thunder:

1. Rebundles the entrypoint and its dependency tree
2. Deploys the updated bundle to the local server
3. Logs the result so you can see errors immediately

Watch mode is intended for local development only. For production deployments, use `thunder bundle` followed by a deploy to the admin API.
