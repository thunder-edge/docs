---
title: Quick Start
description: Go from zero to a running edge function in five minutes
---

This guide walks you through installing Thunder, starting the server, writing a function, bundling it, deploying it, and invoking it. The whole process takes about five minutes.

## Prerequisites

- Rust toolchain (for building from source), **or** a pre-built Thunder binary
- `curl` (for deploying and testing)

## 1. Install or build Thunder

**Option A -- Install script (Linux / macOS):**

```bash
curl -fsSL https://raw.githubusercontent.com/thunder-edge/runtime/main/scripts/install.sh | bash
```

**Option B -- Build from source:**

```bash
git clone https://github.com/thunder-edge/runtime.git
cd deno-edge-runtime
cargo build --release
```

The binary will be at `./target/release/thunder`.

## 2. Start the server

```bash
thunder start
```

Thunder starts two listeners:

| Listener | Default port | Purpose |
|----------|-------------|---------|
| **Admin** | `9000` | Deploy, update, and manage functions (`/_internal/*` endpoints) |
| **Ingress** | `8080` | Route incoming HTTP requests to deployed functions |

You should see output similar to:

```
Thunder edge runtime started
Admin listener: http://0.0.0.0:9000
Ingress listener: http://0.0.0.0:8080
```

:::note
In development, admin endpoints are open by default. For production, always set `--api-key` to require authentication on the admin API.
:::

## 3. Write a hello world function

Create a file called `hello.ts`:

```typescript
export default function handler(req: Request) {
  return new Response("Hello from edge function!", {
    headers: { "content-type": "text/plain" },
  });
}
```

This is the preferred Thunder handler pattern -- use `export default` to expose a function that receives a `Request` and returns a `Response`. Thunder also supports `export default` objects with per-method handlers (e.g. `GET`, `POST`) and the legacy `Deno.serve()` pattern for backwards compatibility.

## 4. Bundle the function

```bash
thunder bundle --entrypoint ./hello.ts --output ./hello.eszip
```

This resolves all imports, compiles TypeScript, and packages everything into a single `.eszip` file.

Expected output:

```
Bundling ./hello.ts -> ./hello.eszip
Bundle created successfully
```

## 5. Deploy the function

Send the bundle to the admin API:

```bash
curl -X POST http://localhost:9000/_internal/functions \
  -H "x-function-name: hello" \
  --data-binary @hello.eszip
```

The `x-function-name` header determines the route path. After deployment, the function will be available at `/hello` on the ingress listener.

Expected response:

```
{"name":"hello","status":"deployed"}
```

## 6. Invoke the function

```bash
curl http://localhost:8080/hello
```

Expected output:

```
Hello from edge function!
```

Your function is live. Any request to `http://localhost:8080/hello` (or `http://localhost:8080/hello/any/subpath`) is routed to your deployed function.

## Dual-listener architecture

It is important to understand the two listeners:

- **Admin API** (`localhost:9000`) -- This is the control plane. Use it to deploy functions (`POST /_internal/functions`), check health (`GET /_internal/health`), and read metrics (`GET /_internal/metrics`). In production, protect it with `--api-key`.

- **Ingress** (`localhost:8080`) -- This is the data plane. It receives public traffic and routes requests to the appropriate function based on the URL path. No authentication is required on this listener.

Both ports are configurable via CLI flags (`--admin-port`, `--port`) or environment variables (`EDGE_RUNTIME_ADMIN_PORT`, `EDGE_RUNTIME_PORT`).

## Next steps

- [Key Concepts](/docs/getting-started/concepts/) -- Understand isolates, bundles, the function registry, and watch mode
- [CLI Commands](/docs/api/cli/) -- Full reference for `thunder start`, `thunder bundle`, `thunder watch`, and more
- [Your First Function](/docs/guides/your-first-function/) -- A deeper walkthrough with request handling, JSON responses, and error handling
- [Testing Functions](/docs/guides/testing/) -- Write and run tests for your edge functions with `thunder test`
