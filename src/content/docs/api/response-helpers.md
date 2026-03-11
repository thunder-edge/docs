---
title: "Response Helpers"
description: "Fluent response builders and auto-detection provided by the thunder:http module."
---

The `thunder:http` module provides typed response builders with a fluent API, an HTTP status map, and a generic auto-response adapter.

## Import

```ts
import {
  HTTP,
  JSONResponse,
  TextResponse,
  HTMLResponse,
  BinaryResponse,
  FileResponse,
  BlobResponse,
  StreamResponse,
  RedirectResponse,
  EmptyResponse,
  ErrorResponse,
  GenericResponse,
  AutoResponse,
  fromGenericResponse,
} from "thunder:http";
```

The `thunder:http` alias is resolved by Thunder CLI flows (`thunder watch`, `thunder bundle`, `thunder test`, `thunder check`).

---

## HTTP Status Map

`HTTP` exports named status codes as integer constants.

| Constant | Value | Constant | Value |
|----------|-------|----------|-------|
| `HTTP.Ok` | 200 | `HTTP.BadRequest` | 400 |
| `HTTP.Created` | 201 | `HTTP.Unauthorized` | 401 |
| `HTTP.Accepted` | 202 | `HTTP.Forbidden` | 403 |
| `HTTP.NoContent` | 204 | `HTTP.NotFound` | 404 |
| `HTTP.MovedPermanently` | 301 | `HTTP.MethodNotAllowed` | 405 |
| `HTTP.Found` | 302 | `HTTP.Conflict` | 409 |
| `HTTP.PermanentRedirect` | 308 | `HTTP.InternalServerError` | 500 |

```ts
HTTP.Ok;                  // 200
HTTP.Created;             // 201
HTTP.NoContent;           // 204
HTTP.MethodNotAllowed;    // 405
HTTP.InternalServerError; // 500
```

---

## Fluent Builder API

All builders return a `ResponseDraft` object that supports chaining. Call `.toResponse()` to produce a standard `Response`.

### Shared Methods

| Method | Description |
|--------|-------------|
| `.status(code)` | Set the HTTP status code |
| `.header(key, value)` | Set a response header |
| `.appendHeader(key, value)` | Append a value to a header (for multi-value headers) |
| `.withHeaders(headers)` | Set multiple headers at once |
| `.cookie(name, value, attributes?)` | Set a `Set-Cookie` header |
| `.toResponse()` | Convert to a standard `Response` object |

### Mutable Properties

| Property | Type | Description |
|----------|------|-------------|
| `statusCode` | `number` | HTTP status code |
| `headers` | `Headers` | Response headers |
| `body` | varies | Response body |

### Example

```ts
return JSONResponse({ message: "created" })
  .status(HTTP.Created)
  .header("x-request-id", "abc-123")
  .cookie("session", "tok_xyz", { httpOnly: true, path: "/" })
  .toResponse();
```

Direct property mutation is also supported:

```ts
const resp = JSONResponse({ ok: true });
resp.statusCode = HTTP.Ok;
resp.headers.set("x-env", "production");
return resp.toResponse();
```

---

## Builders

### JSONResponse

Serializes a value as JSON with `content-type: application/json`.

```ts
return JSONResponse({ id: 42, name: "item" })
  .status(HTTP.Created)
  .toResponse();
```

### TextResponse

Returns a plain text body with `content-type: text/plain`.

```ts
return TextResponse("pong")
  .status(HTTP.Ok)
  .toResponse();
```

### HTMLResponse

Returns an HTML body with `content-type: text/html`.

```ts
return HTMLResponse("<h1>Hello, world</h1>")
  .status(HTTP.Ok)
  .toResponse();
```

### BinaryResponse

Returns raw bytes with `content-type: application/octet-stream`.

```ts
const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
return BinaryResponse(bytes)
  .status(HTTP.Ok)
  .toResponse();
```

### FileResponse

Returns bytes as a file download. Use `.attachment(filename)` to set the `Content-Disposition` header.

```ts
const data = new TextEncoder().encode("report content");
return FileResponse(data)
  .attachment("report.txt")
  .status(HTTP.Ok)
  .toResponse();
```

### BlobResponse

Returns a `Blob` body. Use `.filename(name, disposition)` to configure download behavior.

```ts
const blob = new Blob(["hello"], { type: "text/plain" });
return BlobResponse(blob)
  .filename("hello.txt", "attachment")
  .toResponse();
```

### StreamResponse

Returns a `ReadableStream` body. Supports SSE and NDJSON helpers.

Plain stream:

```ts
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode("chunk-1\n"));
    controller.enqueue(new TextEncoder().encode("chunk-2\n"));
    controller.close();
  },
});

return StreamResponse(stream).toResponse();
```

Server-Sent Events (SSE):

```ts
return StreamResponse(stream)
  .sse()
  .toResponse();
```

The `.sse()` helper sets `content-type: text/event-stream` and `cache-control: no-cache`.

Newline-delimited JSON (NDJSON):

```ts
return StreamResponse(stream)
  .ndjson()
  .toResponse();
```

The `.ndjson()` helper sets `content-type: application/x-ndjson`.

### RedirectResponse

Returns a redirect response with a `Location` header.

```ts
return RedirectResponse("/new-path")
  .status(HTTP.PermanentRedirect)
  .toResponse();
```

### EmptyResponse

Returns a response with no body.

```ts
return EmptyResponse()
  .status(HTTP.NoContent)
  .toResponse();
```

### ErrorResponse

Returns a JSON error body with a code and optional detail object.

```ts
return ErrorResponse("invalid_payload", { expected: "{ name: string }" })
  .status(HTTP.BadRequest)
  .toResponse();
```

Produces:

```json
{
  "error": "invalid_payload",
  "detail": { "expected": "{ name: string }" }
}
```

---

## GenericResponse

`GenericResponse(value, init?)` auto-detects the value type and returns a standard `Response`. Aliases: `AutoResponse`, `fromGenericResponse`.

```ts
export default async function handler(req: Request): Promise<Response> {
  if (req.method === "GET") {
    return GenericResponse({ ok: true });           // JSON
  }
  if (req.method === "POST") {
    return GenericResponse("accepted", { status: HTTP.Accepted }); // text/plain
  }
  return GenericResponse(null);                     // 204 No Content
}
```

### Inference Rules

`GenericResponse` applies the following rules in order:

| Priority | Input Type | Result |
|----------|-----------|--------|
| 1 | `Response` | Passthrough (returned as-is) |
| 2 | `ResponseDraft` | Calls `.toResponse()` |
| 3 | Envelope `{ body, status?, headers? }` | Uses envelope metadata |
| 4 | `null` or `undefined` | Empty response (default `204`) |
| 5 | `ReadableStream` | Stream response |
| 6 | `Blob` | Blob response |
| 7 | `ArrayBuffer` or typed array | Binary response |
| 8 | `string` | Text response (`text/plain`) |
| 9 | `number`, `boolean`, `bigint` | Text response via `String(value)` |
| 10 | Object or array | JSON response (`application/json`) |

### Envelope Pattern

Return an object with `body`, `status`, and `headers` fields to control the response metadata alongside the body:

```ts
return GenericResponse({
  status: HTTP.Created,
  headers: { "x-resource-id": "42" },
  body: { id: 42, name: "item" },
});
```

---

## Method Handler Object

When using `export default { GET, POST, ... }`, Thunder handles `405 Method Not Allowed` with an `Allow` header automatically for unmatched methods.

```ts
import { HTTP, JSONResponse } from "thunder:http";

export default {
  GET() {
    return JSONResponse({ ok: true }).status(HTTP.Ok).toResponse();
  },
  POST(req: Request) {
    return JSONResponse({ created: true }).status(HTTP.Created).toResponse();
  },
};
```
