---
title: "JSON API"
---

A REST API example that defines multiple routes returning JSON responses. It demonstrates URL pattern matching, CORS preflight handling, and structured error responses using the `export default function` pattern with `thunder:http` helpers.

## Routes

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/users` | Returns a list of users. |
| `GET` | `/api/users/:id` | Returns a single user by ID. |
| `POST` | `/api/echo` | Echoes the request body back as JSON. |
| `OPTIONS` | `*` | CORS preflight response. |

## Code

```typescript
// examples/json-api/json-api.ts

import { JSONResponse, ErrorResponse, EmptyResponse, HTTP } from "thunder:http";

const routes = {
  "/api/users": {
    GET: () => [
      { id: 1, name: "Alice", email: "alice@example.com" },
      { id: 2, name: "Bob", email: "bob@example.com" },
      { id: 3, name: "Charlie", email: "charlie@example.com" },
    ],
  },
  "/api/users/:id": {
    GET: (id: string) => ({
      id: parseInt(id),
      name: `User ${id}`,
      email: `user${id}@example.com`,
    }),
  },
  "/api/echo": {
    POST: async (body: unknown) => ({
      message: "Echo received",
      data: body,
      timestamp: new Date().toISOString(),
    }),
  },
};

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const method = req.method;
  const pathname = url.pathname;

  const corsHeader = { "access-control-allow-origin": "*" };

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return EmptyResponse()
      .header("access-control-allow-origin", "*")
      .header("access-control-allow-methods", "GET, POST, OPTIONS")
      .header("access-control-allow-headers", "content-type")
      .toResponse();
  }

  // Route: GET /api/users
  if (pathname === "/api/users" && method === "GET") {
    const users = routes["/api/users"].GET();
    return JSONResponse(users)
      .header("access-control-allow-origin", "*")
      .toResponse();
  }

  // Route: GET /api/users/:id
  const userMatch = pathname.match(/^\/api\/users\/(\d+)$/);
  if (userMatch && method === "GET") {
    const user = routes["/api/users/:id"].GET(userMatch[1]);
    return JSONResponse(user)
      .header("access-control-allow-origin", "*")
      .toResponse();
  }

  // Route: POST /api/echo
  if (pathname === "/api/echo" && method === "POST") {
    try {
      const body = await req.json();
      const response = await routes["/api/echo"].POST(body);
      return JSONResponse(response)
        .header("access-control-allow-origin", "*")
        .toResponse();
    } catch {
      return ErrorResponse("Invalid JSON")
        .status(HTTP.BadRequest)
        .header("access-control-allow-origin", "*")
        .toResponse();
    }
  }

  // 404 Not Found
  return ErrorResponse("Not found")
    .status(HTTP.NotFound)
    .header("access-control-allow-origin", "*")
    .toResponse();
}
```

## Run locally

```bash
thunder watch --path ./examples/json-api/json-api.ts
```

## Try it

List all users:

```bash
curl http://localhost:9000/api/users
```

```json
[
  { "id": 1, "name": "Alice", "email": "alice@example.com" },
  { "id": 2, "name": "Bob", "email": "bob@example.com" },
  { "id": 3, "name": "Charlie", "email": "charlie@example.com" }
]
```

Get a single user:

```bash
curl http://localhost:9000/api/users/1
```

```json
{ "id": 1, "name": "User 1", "email": "user1@example.com" }
```

Echo a POST body:

```bash
curl -X POST http://localhost:9000/api/echo \
  -H "Content-Type: application/json" \
  -d '{"hello": "world"}'
```

```json
{
  "message": "Echo received",
  "data": { "hello": "world" },
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

## Key patterns

- **`export default function`** -- The function receives every inbound `Request` and returns a `Response`. Since this example does its own URL routing, a single handler function is more natural than the method-dispatch object pattern.
- **`thunder:http` helpers** -- `JSONResponse`, `ErrorResponse`, and `EmptyResponse` eliminate boilerplate for common response types. The builder chain (`.status()`, `.header()`, `.toResponse()`) keeps response construction readable.
- **CORS preflight** -- The `OPTIONS` handler returns the required `access-control-*` headers with an empty body, allowing cross-origin requests from any domain.
- **Error handling** -- The `POST /api/echo` route catches JSON parse errors and returns a `400 Bad Request` with a structured error object via `ErrorResponse`.
