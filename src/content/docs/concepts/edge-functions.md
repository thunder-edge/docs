---
title: "Edge Functions"
---

Edge functions are the primary unit of execution in Thunder. Each function is a JavaScript or TypeScript module that handles HTTP requests inside an isolated V8 sandbox. Thunder supports multiple handler patterns so you can choose the style that best fits your use case.

## Handler Patterns

Thunder recognizes three patterns when loading a function module:

1. **export default function** -- the preferred pattern for single handlers (recommended).
2. **export default object** -- a RESTful pattern with explicit method handlers (recommended for multi-method APIs).
3. **Deno.serve() callback** -- the legacy Deno-style pattern (backwards compatible).

All three patterns coexist. Thunder detects which one a module uses at load time and dispatches requests accordingly.

---

### Pattern 1: Export Default Function (Preferred)

Export a single default function that handles all requests. This is the simplest and most idiomatic way to write an edge function. Use it when you want full control over dispatch or when every request goes through the same handler.

```ts
import { JSONResponse, HTTP } from "thunder:http";

export default function handler(req: Request): Response {
  return JSONResponse({ message: "hello" })
    .status(HTTP.Ok)
    .toResponse();
}
```

You can also use `GenericResponse` for quick handlers where the response type is inferred automatically from the value you pass. Objects and arrays become JSON, strings become plain text, `null` becomes a 204, and so on.

```ts
import { GenericResponse } from "thunder:http";

export default async function handler(req: Request): Promise<Response> {
  return GenericResponse({ message: "hello" });
}
```

---

### Pattern 2: Export Default Object (RESTful)

Export a default object whose keys are uppercase HTTP method names. Thunder dispatches the incoming request to the matching handler automatically.

```ts
import { JSONResponse, HTTP } from "thunder:http";

export default {
  GET(req: Request) {
    return JSONResponse({ ok: true }).status(HTTP.Ok).toResponse();
  },
  POST(req: Request) {
    return JSONResponse({ created: true }).status(HTTP.Created).toResponse();
  },
};
```

When the incoming method does not match any key in the object, Thunder returns a `405 Method Not Allowed` response with an `Allow` header listing the supported methods. You do not need to handle this yourself.

For example, if the object above receives a `DELETE` request, the response is:

```
HTTP/1.1 405 Method Not Allowed
Allow: GET, POST
```

This makes RESTful APIs straightforward to build without boilerplate.

---

### Pattern 3: Deno.serve() Callback (Legacy)

Call `Deno.serve()` with a callback that receives a `Request` and returns a `Response`. This pattern is fully backwards compatible -- existing functions continue to work without changes. For new functions, prefer one of the `export default` patterns above.

```ts
Deno.serve((req) => {
  return new Response("Hello!", { headers: { "content-type": "text/plain" } });
});
```

The callback runs for every incoming request regardless of HTTP method. You are responsible for routing, method checks, and error responses.

---

## Response Helpers (`thunder:http`)

The `thunder:http` module provides fluent response builders and a generic auto-response adapter. These are available in all handler patterns, not just the export default style.

### Fluent Builders

Every builder supports chaining with `.status()`, `.header()`, `.cookie()`, and `.toResponse()`.

```ts
import { JSONResponse, HTTP } from "thunder:http";

return JSONResponse({ id: 42 })
  .status(HTTP.Created)
  .header("x-request-id", "abc")
  .cookie("session", "tok_abc123", { httpOnly: true, path: "/" })
  .toResponse();
```

Available builders:

| Builder | Content-Type | Description |
|---------|-------------|-------------|
| `JSONResponse` | `application/json` | Serializes objects to JSON. |
| `TextResponse` | `text/plain` | Plain text body. |
| `HTMLResponse` | `text/html` | HTML body. |
| `ErrorResponse` | `application/json` | Structured error envelope. |
| `EmptyResponse` | (none) | No body (typically 204). |
| `StreamResponse` | (varies) | `ReadableStream` body with SSE and NDJSON helpers. |
| `RedirectResponse` | (none) | HTTP redirect. |
| `BinaryResponse` | `application/octet-stream` | Raw bytes (`Uint8Array`). |
| `FileResponse` | `application/octet-stream` | Bytes with `Content-Disposition` attachment. |
| `BlobResponse` | (from Blob) | Blob body with optional filename. |

### GenericResponse / AutoResponse

For quick handlers, `GenericResponse(value, init?)` inspects the value and picks the right builder automatically.

```ts
import { GenericResponse, HTTP } from "thunder:http";

// Object -> JSON response
return GenericResponse({ ok: true });

// String -> text/plain
return GenericResponse("accepted", { status: HTTP.Accepted });

// null -> 204 No Content
return GenericResponse(null);
```

### HTTP Status Map

The `HTTP` export provides named status codes for readability.

```ts
HTTP.Ok;                  // 200
HTTP.Created;             // 201
HTTP.NoContent;           // 204
HTTP.BadRequest;          // 400
HTTP.MethodNotAllowed;    // 405
HTTP.InternalServerError; // 500
```

---

## Choosing a Pattern

| Criteria | export default function | export default object | Deno.serve() (legacy) |
|----------|------------------------|----------------------|-----------------------|
| Recommended for new code | Yes | Yes | No |
| Familiar Deno style | No | No | Yes |
| Automatic 405 handling | No | Yes | No |
| Per-method handlers | Manual | Built-in | Manual |
| Full routing control | Yes | Limited | Yes |
| Best for REST APIs | -- | Yes | -- |
| Best for catch-all | Yes | -- | -- |

All three patterns can use `thunder:http` response helpers. The `Deno.serve()` pattern is fully backwards compatible; existing functions continue to work without changes. For new functions, prefer `export default function` for single handlers or `export default object` for RESTful multi-method APIs.
