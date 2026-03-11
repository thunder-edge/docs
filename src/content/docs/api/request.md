---
title: "Request Object"
description: "The standard Web Fetch API Request object used by Thunder function handlers."
---

Thunder function handlers receive a standard Web [Fetch API `Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) object. This is the same `Request` used by Deno and modern browser APIs.

## Handler Signatures

### Default function export

```ts
export default async function handler(req: Request): Promise<Response> {
  return new Response(req.method);
}
```

### Method object export

```ts
export default {
  async GET(req: Request) {
    return new Response("Hello from GET");
  },
  async POST(req: Request) {
    const body = await req.json();
    return new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" },
    });
  },
};
```

When using the method object pattern, Thunder automatically responds with `405 Method Not Allowed` and an `Allow` header for methods not defined in the object.

---

## Core Properties

| Property | Type | Description |
|----------|------|-------------|
| `req.method` | `string` | HTTP method (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`) |
| `req.url` | `string` | Absolute URL string |
| `req.headers` | `Headers` | Case-insensitive header map |
| `req.body` | `ReadableStream<Uint8Array> \| null` | Request body stream |
| `req.bodyUsed` | `boolean` | Whether the body has been consumed |
| `req.signal` | `AbortSignal` | Cancellation signal |

---

## URL Parsing

Use the `URL` constructor to parse `req.url` into its components.

```ts
const url = new URL(req.url);

url.pathname;          // "/api/users/42"
url.search;            // "?page=2"
url.origin;            // "http://localhost:8080"
url.host;              // "localhost:8080"

// Extract path segments
const userId = url.pathname.split("/").at(-1);

// Read query parameters
const page = url.searchParams.get("page");      // "2"
const tags = url.searchParams.getAll("tag");     // ["a", "b"]
```

---

## Header Access

```ts
const contentType = req.headers.get("content-type");
const auth = req.headers.get("authorization");
const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

// Check for header presence
if (req.headers.has("x-custom-header")) {
  // ...
}

// Iterate all headers
for (const [key, value] of req.headers) {
  console.log(`${key}: ${value}`);
}
```

---

## Body Readers

The request body can be consumed exactly once. Use one of these methods:

| Method | Return Type | Description |
|--------|-------------|-------------|
| `req.text()` | `Promise<string>` | Read body as UTF-8 text |
| `req.json()` | `Promise<any>` | Parse body as JSON |
| `req.arrayBuffer()` | `Promise<ArrayBuffer>` | Read body as raw bytes |
| `req.blob()` | `Promise<Blob>` | Read body as a Blob |
| `req.formData()` | `Promise<FormData>` | Parse body as multipart/form-data or URL-encoded |

### Examples

JSON body:

```ts
export default async function handler(req: Request): Promise<Response> {
  const payload = await req.json();
  return new Response(JSON.stringify({ received: payload }), {
    headers: { "content-type": "application/json" },
  });
}
```

Form data:

```ts
export default async function handler(req: Request): Promise<Response> {
  const form = await req.formData();
  const name = form.get("name");
  const file = form.get("file"); // File object for uploads
  return new Response(`Hello, ${name}`);
}
```

Streaming body:

```ts
export default async function handler(req: Request): Promise<Response> {
  if (!req.body) {
    return new Response("No body", { status: 400 });
  }
  const reader = req.body.getReader();
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
  }
  return new Response(`Received ${total} bytes`);
}
```

---

## `clone()`

If you need to read the body in middleware and still forward the request, clone it first. The clone gets an independent body stream.

```ts
const clone = req.clone();
const auditPayload = await clone.text();
// req.body is still unconsumed and readable
const body = await req.json();
```

---

## Cookie Parsing

`Request` does not include a built-in cookie parser. Parse cookies from the `Cookie` header manually.

```ts
function parseCookies(req: Request): Record<string, string> {
  const raw = req.headers.get("cookie") ?? "";
  const cookies: Record<string, string> = {};
  for (const pair of raw.split(";")) {
    const [key, ...rest] = pair.trim().split("=");
    if (!key) continue;
    cookies[key] = decodeURIComponent(rest.join("=") || "");
  }
  return cookies;
}

export default async function handler(req: Request): Promise<Response> {
  const cookies = parseCookies(req);
  const session = cookies["session_id"];
  return new Response(`Session: ${session ?? "none"}`);
}
```

---

## Method Routing Example

```ts
import { GenericResponse, HTTP } from "thunder:http";

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === "GET") {
    return GenericResponse({ ok: true }, { status: HTTP.Ok });
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => null);
    if (!body) {
      return GenericResponse(
        { error: "invalid_json" },
        { status: HTTP.BadRequest },
      );
    }
    return GenericResponse(
      { created: true, body },
      { status: HTTP.Created },
    );
  }

  return GenericResponse(
    { error: "method_not_supported" },
    { status: HTTP.MethodNotAllowed },
  );
}
```

---

## Additional Fetch Properties

Depending on request origin, these properties may also be present on `req`:

| Property | Type | Description |
|----------|------|-------------|
| `cache` | `string` | Cache mode |
| `credentials` | `string` | Credentials mode |
| `destination` | `string` | Request destination |
| `integrity` | `string` | Subresource integrity hash |
| `keepalive` | `boolean` | Keep-alive flag |
| `mode` | `string` | Request mode |
| `redirect` | `string` | Redirect mode |
| `referrer` | `string` | Referrer URL |
| `referrerPolicy` | `string` | Referrer policy |

---

## Notes

- Request semantics follow the Fetch standard used by Deno and Web APIs.
- Body can only be consumed once. Attempting to read it a second time throws a `TypeError`.
- In explicit method object handlers (`export default { GET, POST, ... }`), the runtime returns `405 Method Not Allowed` with an `Allow` header for unmatched verbs.
