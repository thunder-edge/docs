---
title: "RESTful APIs"
description: "Build CRUD APIs using export default method handlers and thunder:http response helpers."
---

Thunder supports an `export default` object pattern that maps HTTP methods directly to named handler functions. Combined with the `thunder:http` response helpers, this pattern lets you build clean RESTful APIs with minimal boilerplate.

## The method handler pattern

Instead of routing manually inside a single handler function, export a default object where each key is an HTTP method:

```ts
import { JSONResponse, EmptyResponse, ErrorResponse, HTTP } from "thunder:http";

export default {
  GET(req: Request) {
    return JSONResponse({ message: "list items" }).toResponse();
  },

  POST(req: Request) {
    return JSONResponse({ created: true })
      .status(HTTP.Created)
      .toResponse();
  },

  DELETE(req: Request) {
    return EmptyResponse()
      .status(HTTP.NoContent)
      .toResponse();
  },
};
```

Thunder automatically dispatches incoming requests to the matching method handler. If a request arrives with a method that has no corresponding handler (for example, PATCH on the object above), the runtime returns `405 Method Not Allowed` with an `Allow` header listing the supported methods. You do not need to handle this yourself.

## Importing thunder:http

The `thunder:http` module provides response builders and an HTTP status map. Import what you need:

```ts
import {
  HTTP,
  JSONResponse,
  TextResponse,
  HTMLResponse,
  EmptyResponse,
  ErrorResponse,
  StreamResponse,
  RedirectResponse,
  BinaryResponse,
  FileResponse,
  GenericResponse,
} from "thunder:http";
```

The `thunder:http` alias is resolved by Thunder CLI flows (`thunder watch`, `thunder bundle`, `thunder test`, `thunder check`).

## HTTP status map

The `HTTP` export provides named constants for standard status codes:

```ts
HTTP.Ok;                  // 200
HTTP.Created;             // 201
HTTP.NoContent;           // 204
HTTP.BadRequest;          // 400
HTTP.NotFound;            // 404
HTTP.MethodNotAllowed;    // 405
HTTP.InternalServerError; // 500
```

## Fluent builder API

All response builders support method chaining and finalize with `.toResponse()`:

```ts
return JSONResponse({ id: 42 })
  .status(HTTP.Created)
  .header("x-request-id", "abc-123")
  .toResponse();
```

Shared builder methods:

| Method | Description |
|--------|-------------|
| `.status(code)` | Set the HTTP status code |
| `.header(key, value)` | Set a response header |
| `.appendHeader(key, value)` | Append a value to an existing header |
| `.withHeaders(headers)` | Set multiple headers at once |
| `.cookie(name, value, attributes?)` | Set a cookie |
| `.toResponse()` | Build the final `Response` object |

## CRUD example

Here is a complete in-memory CRUD API using the method handler pattern:

```ts
import { JSONResponse, EmptyResponse, ErrorResponse, HTTP } from "thunder:http";

let nextId = 3;
const items = new Map<number, { id: number; name: string }>([
  [1, { id: 1, name: "alpha" }],
  [2, { id: 2, name: "beta" }],
]);

function idFromUrl(req: Request): number | null {
  const match = new URL(req.url).pathname.match(/\/(\d+)$/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export default {
  async GET(req: Request) {
    const id = idFromUrl(req);
    if (id !== null) {
      const item = items.get(id);
      if (!item) {
        return ErrorResponse("not_found")
          .status(HTTP.NotFound)
          .toResponse();
      }
      return JSONResponse(item).toResponse();
    }

    return JSONResponse({
      data: Array.from(items.values()),
    }).toResponse();
  },

  async POST(req: Request) {
    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return JSONResponse({ error: "invalid_payload", expected: "{ name: string }" })
        .status(HTTP.BadRequest)
        .toResponse();
    }

    const item = { id: nextId++, name };
    items.set(item.id, item);

    return JSONResponse(item)
      .status(HTTP.Created)
      .header("location", `/items/${item.id}`)
      .toResponse();
  },

  async DELETE(req: Request) {
    const id = idFromUrl(req);
    if (id === null) {
      return ErrorResponse("id_required")
        .status(HTTP.BadRequest)
        .toResponse();
    }

    if (!items.delete(id)) {
      return ErrorResponse("not_found")
        .status(HTTP.NotFound)
        .toResponse();
    }

    return EmptyResponse()
      .status(HTTP.NoContent)
      .toResponse();
  },
};
```

### Testing the CRUD API

After bundling and deploying (or using `thunder watch`):

```bash
# List all items
curl http://localhost:8080/items

# Get a single item
curl http://localhost:8080/items/1

# Create an item
curl -X POST http://localhost:8080/items \
  -H "content-type: application/json" \
  -d '{"name": "gamma"}'

# Delete an item
curl -X DELETE http://localhost:8080/items/2

# Unsupported method returns 405
curl -X PATCH http://localhost:8080/items/1
```

## Response builders reference

### JSONResponse

Serializes a value as JSON with `content-type: application/json`:

```ts
return JSONResponse({ id: 1, name: "alpha" })
  .status(HTTP.Ok)
  .toResponse();
```

### TextResponse

Returns plain text with `content-type: text/plain`:

```ts
return TextResponse("pong").toResponse();
```

### HTMLResponse

Returns HTML with `content-type: text/html`:

```ts
return HTMLResponse("<h1>Hello</h1>").toResponse();
```

### ErrorResponse

Returns a JSON error body. Accepts an error code string and optional details:

```ts
return ErrorResponse("invalid_payload", { expected: "{ name: string }" })
  .status(HTTP.BadRequest)
  .toResponse();
```

### EmptyResponse

Returns a response with no body, typically used with 204 No Content:

```ts
return EmptyResponse()
  .status(HTTP.NoContent)
  .toResponse();
```

### RedirectResponse

Returns a redirect response:

```ts
return RedirectResponse("/new-path")
  .status(HTTP.PermanentRedirect)
  .toResponse();
```

### BinaryResponse

Returns raw bytes with `content-type: application/octet-stream`:

```ts
const bytes = new Uint8Array([1, 2, 3]);
return BinaryResponse(bytes).toResponse();
```

### FileResponse

Returns a file download response with a `Content-Disposition` header:

```ts
const bytes = new TextEncoder().encode("report data");
return FileResponse(bytes)
  .attachment("report.txt")
  .toResponse();
```

## GenericResponse auto-detection

For quick handlers, `GenericResponse(value, init?)` infers the correct response type automatically:

```ts
import { GenericResponse, HTTP } from "thunder:http";

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "GET") {
    return GenericResponse({ ok: true }); // inferred as JSON
  }

  if (req.method === "POST") {
    return GenericResponse("accepted", { status: HTTP.Accepted }); // inferred as text/plain
  }

  return GenericResponse(null); // 204 No Content
}
```

### Inference rules

`GenericResponse` applies these rules in order:

1. `Response` -- passthrough, returned as-is.
2. `ResponseDraft` (builder instance) -- calls `.toResponse()`.
3. Envelope object `{ body, status?, headers? }` -- uses envelope metadata.
4. `null` / `undefined` -- empty response (default 204).
5. `ReadableStream` -- stream response.
6. `Blob` -- blob response.
7. `ArrayBuffer` / typed arrays -- binary response.
8. `string` -- text response.
9. `number` / `boolean` / `bigint` -- text response via `String(value)`.
10. Objects / arrays -- JSON response.

## Default function handler pattern

You can also use `export default function` for a single handler that receives all methods:

```ts
import { GenericResponse, HTTP } from "thunder:http";

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method.toUpperCase();

  if (method === "GET") {
    return GenericResponse({ status: "ok" });
  }

  return GenericResponse(null, { status: HTTP.MethodNotAllowed });
}
```

When using the `export default { GET, POST, ... }` object pattern, the runtime handles 405 responses automatically. When using a single `export default function`, you are responsible for method routing yourself.
