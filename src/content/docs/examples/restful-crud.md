---
title: "RESTful CRUD"
---

This example uses the `export default` object pattern with Thunder's built-in `thunder:http` module. Instead of a single `export default function` handler, you export an object whose keys are HTTP method names (`GET`, `POST`, `DELETE`, etc.). Thunder dispatches inbound requests to the matching method handler automatically.

## The `thunder:http` module

The `thunder:http` module provides response helper classes and HTTP status constants:

| Export | Description |
|---|---|
| `JSONResponse(data)` | Creates a JSON response with `content-type: application/json`. |
| `TextResponse(body)` | Creates a plain-text response with `content-type: text/plain`. |
| `HTMLResponse(body)` | Creates an HTML response with `content-type: text/html`. |
| `ErrorResponse(message)` | Creates a JSON error response with `{ "error": "<message>" }`. |
| `EmptyResponse()` | Creates an empty response (useful for `204 No Content`). |
| `StreamResponse(stream)` | Creates a streaming response from a `ReadableStream`. |
| `HTTP` | Object with HTTP status code constants (`HTTP.Ok`, `HTTP.Created`, `HTTP.NotFound`, etc.). |

All response helpers return a builder with `.status()`, `.header()`, and `.toResponse()` methods.

## Code

```typescript
// examples/restful-default/restful-default.ts

import { EmptyResponse, ErrorResponse, HTTP, JSONResponse } from "thunder:http";

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
      resource: "items",
      data: Array.from(items.values()),
      hint: "POST /items with { name }, GET /items/:id, DELETE /items/:id",
    })
      .status(HTTP.Ok)
      .toResponse();
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

## Run locally

```bash
thunder watch --path ./examples/restful-default/restful-default.ts
```

## Try it

List all items:

```bash
curl http://localhost:9000/
```

```json
{
  "resource": "items",
  "data": [
    { "id": 1, "name": "alpha" },
    { "id": 2, "name": "beta" }
  ],
  "hint": "POST /items with { name }, GET /items/:id, DELETE /items/:id"
}
```

Get a single item:

```bash
curl http://localhost:9000/1
```

```json
{ "id": 1, "name": "alpha" }
```

Create a new item:

```bash
curl -X POST http://localhost:9000/ \
  -H "Content-Type: application/json" \
  -d '{"name": "gamma"}'
```

```json
{ "id": 3, "name": "gamma" }
```

The response includes a `Location: /items/3` header.

Delete an item:

```bash
curl -X DELETE http://localhost:9000/2
# 204 No Content
```

Request a missing item:

```bash
curl http://localhost:9000/999
```

```json
{ "error": "not_found" }
```

## Key patterns

- **`export default` dispatch** -- Thunder inspects the default export. If it is an object with method-named keys (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`), Thunder routes the request to the matching handler. If the method is not defined, Thunder returns `405 Method Not Allowed`.
- **Response builder chain** -- `JSONResponse(data).status(HTTP.Created).header("location", "/items/3").toResponse()` produces a fully configured `Response` object in a readable, chainable style.
- **In-memory state** -- The `items` Map persists across requests within the same isolate. It resets when the isolate is recycled. For production use, connect to an external data store.
- **`export default function`** -- You can also export a single async function instead of a method object. This is preferred when you need custom routing logic. See the [JSON API](/docs/examples/json-api/) example for that pattern.
- **Legacy `Deno.serve()`** -- The `Deno.serve()` API is still supported for backwards compatibility, but the `export default` patterns are preferred for new functions.
