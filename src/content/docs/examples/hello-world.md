---
title: "Hello World"
---

The simplest Thunder edge function. It responds to every request with a plain-text greeting.

## Code

```typescript
// examples/hello/hello.ts
import { TextResponse } from "thunder:http";

export default function handler(req: Request) {
  return TextResponse("Hello from edge function!").toResponse();
}
```

The `export default function` pattern is the preferred way to define a Thunder edge function with a single handler. Thunder invokes the exported function for every inbound HTTP request routed to this function. The function receives a standard `Request` object and must return a `Response` (or a `Promise<Response>`).

The `TextResponse` helper from the `thunder:http` module creates a response with `content-type: text/plain` automatically. You can also chain `.status()` and `.header()` before `.toResponse()` for further customization.

## Run locally

Start the function with hot-reload:

```bash
thunder watch --path ./examples/hello/hello.ts
```

Then test it:

```bash
curl http://localhost:9000/
# Hello from edge function!
```

## Bundle

Create an eszip bundle for deployment:

```bash
thunder bundle --entrypoint ./examples/hello/hello.ts --output ./hello.eszip
```

Or a snapshot bundle (faster cold starts):

```bash
thunder bundle --entrypoint ./examples/hello/hello.ts --output ./hello.snapshot.bundle --format snapshot
```

## Deploy

Deploy the bundle to a running Thunder server via the admin API:

```bash
curl -X POST http://localhost:9001/functions \
  -H "Content-Type: application/octet-stream" \
  -H "X-Function-Name: hello" \
  --data-binary @./hello.eszip
```

## Invoke

Once deployed, invoke the function through the ingress listener:

```bash
curl http://localhost:9000/hello
# Hello from edge function!
```

## What to try next

- Return JSON instead of plain text -- see [JSON API](/docs/examples/json-api/).
- Use the `export default` object pattern with HTTP method handlers -- see [RESTful CRUD](/docs/examples/restful-crud/).
- Explore all 30 examples in the [Examples overview](/docs/examples/overview/).
