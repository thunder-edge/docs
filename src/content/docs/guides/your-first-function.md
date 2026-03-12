---
title: "Your First Function"
description: "Step-by-step guide to creating, bundling, deploying, and invoking a Thunder edge function."
---

This guide walks you through the full lifecycle of a Thunder edge function: writing it, bundling it into a deployable package, starting the runtime, deploying via the admin API, and invoking it through the ingress listener.

## Prerequisites

- The `thunder` binary installed and available in your `PATH`. See the [installation instructions](https://github.com/thunder-edge/runtime#install-github-releases) for details.
- `curl` for HTTP requests (or any HTTP client of your choice).

## 1. Write the function

Create a file called `hello.ts`:

```ts
import { TextResponse } from "thunder:http";

export default function handler(req: Request): Response {
  return TextResponse("Hello from Thunder!").toResponse();
}
```

Thunder functions use an `export default` pattern. The preferred approach is to export a default function that receives a Web `Request` object and returns a `Response`. You can also export a default object with named method handlers (`GET`, `POST`, `DELETE`, etc.) for RESTful APIs. The legacy `Deno.serve()` API remains supported for backwards compatibility.

## 2. Bundle the function

Thunder packages functions into ESZIP bundles before deployment. Run:

```bash
thunder bundle --entrypoint ./hello.ts --output ./hello.eszip
```

This resolves all imports, compiles TypeScript, and produces a single `hello.eszip` file ready for deployment.

If you have `deno` in your PATH, the bundler also runs type checking before packaging. Otherwise it performs syntax and module-graph validation only.

## 3. Start the runtime server

In a separate terminal, start Thunder:

```bash
thunder start
```

This starts two listeners:

| Listener | Default Port | Purpose |
|----------|-------------|---------|
| Admin    | 9000        | Function management (`/_internal/*` endpoints) |
| Ingress  | 8080        | Function invocation (`/{function_name}/...`)    |

You can customize ports with `--admin-port` and `--port`:

```bash
thunder start --port 8080 --admin-port 9000
```

## 4. Deploy the function

Use the admin API to deploy the bundled function:

```bash
curl -X POST http://localhost:9000/_internal/functions \
  -H "x-function-name: hello" \
  -H "content-type: application/octet-stream" \
  --data-binary @./hello.eszip
```

The `x-function-name` header sets the name used for routing. The binary body is the ESZIP bundle.

On success the response confirms the function is deployed and ready to receive requests.

## 5. Invoke the function

Send a request through the ingress listener using the function name as the first path segment:

```bash
curl http://localhost:8080/hello
```

Expected output:

```
Hello from Thunder!
```

Any path after the function name is forwarded to the handler. For example, `http://localhost:8080/hello/api/ping` forwards `/api/ping` as the request path inside the function.

## 6. Update the function

After editing your source code and re-bundling, update the deployed function with a PUT request:

```bash
thunder bundle --entrypoint ./hello.ts --output ./hello.eszip

curl -X PUT http://localhost:9000/_internal/functions/hello \
  -H "content-type: application/octet-stream" \
  --data-binary @./hello.eszip
```

The function is replaced in-place. Subsequent requests use the new code immediately.

## 7. Delete the function

Remove a deployed function with DELETE:

```bash
curl -X DELETE http://localhost:9000/_internal/functions/hello
```

After deletion, requests to `/hello` on the ingress listener return a 404 response.

## 8. List deployed functions

Check what is currently deployed:

```bash
curl http://localhost:9000/_internal/functions
```

This returns a JSON array with metadata for each deployed function.

## Alternative: Watch mode

For local development, `thunder watch` automates the bundle-deploy cycle. It watches a directory for `.ts` and `.js` files, bundles them automatically, and deploys or updates functions on every file change.

```bash
thunder watch --path ./examples --port 9000
```

In watch mode, function names are derived from file paths. For example, `./examples/hello/hello.ts` becomes the function `hello-hello`, and a top-level `./examples/hello.ts` becomes `hello`.

Watch mode is a single-listener server (the `--port` flag sets the combined listener). Functions are invoked at `http://localhost:9000/{function_name}`.

This mode is intended for development only. For production, use the `start` command with the bundle-and-deploy workflow described above.

## Next steps

- **[RESTful APIs](/docs/guides/restful-apis/)** -- Build a CRUD API using `export default` method handlers and `thunder:http` response helpers.
- **[Testing Functions](/docs/guides/testing/)** -- Write and run tests using the built-in `thunder:testing` library.
- **[Debugging](/docs/guides/debugging/)** -- Attach VS Code, Chrome DevTools, or Neovim to debug functions with breakpoints.
