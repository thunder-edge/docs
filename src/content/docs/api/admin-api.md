---
title: "Admin API"
description: "HTTP management endpoints served on the Thunder admin listener."
---

The admin API is served on the **admin listener** (default port `9000`). All endpoints are under the `/_internal/*` prefix.

The **ingress listener** (default port `8080`) handles function invocation at `/{function_name}/*` and does not expose admin endpoints.

## Authentication

When `--api-key` is set (or `EDGE_RUNTIME_API_KEY`), every request to `/_internal/*` must include the `X-API-Key` header.

```bash
# Rejected (401 Unauthorized)
curl http://localhost:9000/_internal/health

# Accepted (200 OK)
curl -H "X-API-Key: your-secret-key" http://localhost:9000/_internal/health
```

If `--api-key` is not set, admin endpoints are open. A warning is logged at startup. This is acceptable for local development but not recommended for production.

---

## Endpoint Reference

### `GET /_internal/health`

Health check. Returns `200 OK` when the runtime is operational.

```bash
curl http://localhost:9000/_internal/health
```

```json
{ "status": "ok" }
```

---

### `GET /_internal/metrics`

Returns a JSON object with runtime and per-function metrics. See the [Metrics Endpoint](/api/metrics/) reference for the full schema.

```bash
curl http://localhost:9000/_internal/metrics
```

The response is cached for 15 seconds. Use `?fresh=1` to force recomputation.

```bash
curl 'http://localhost:9000/_internal/metrics?fresh=1'
```

### `GET /metrics`

Alias for `/_internal/metrics`. Served on the admin listener. Same caching behavior and `?fresh=1` override.

```bash
curl http://localhost:9000/metrics
curl 'http://localhost:9000/metrics?fresh=1'
```

---

### `GET /_internal/functions`

List all deployed functions.

```bash
curl -H "X-API-Key: $KEY" http://localhost:9000/_internal/functions
```

Response is an array of function info objects including:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Function slug |
| `status` | string | `loading`, `running`, `error`, `shutting_down` |
| `bundle_format` | string | `eszip` or `snapshot` |
| `package_v8_version` | string | V8 version in the deployed package |
| `runtime_v8_version` | string | V8 version in the current runtime |
| `snapshot_compatible_with_runtime` | boolean | Whether V8 versions match |
| `requires_snapshot_regeneration` | boolean | `true` when snapshot format and V8 mismatch |
| `created_at` | string | RFC 3339 timestamp |
| `updated_at` | string | RFC 3339 timestamp |

---

### `POST /_internal/functions`

Deploy a new function. The request body is the bundle payload (ESZIP or snapshot format).

#### Required Headers

| Header | Description |
|--------|-------------|
| `x-function-name` | Name for the deployed function |

#### Optional Headers

| Header | Description |
|--------|-------------|
| `x-function-manifest-b64` | Base64-encoded function manifest JSON (v2) |
| `x-function-manifest-profile` | Profile name to resolve from the manifest |
| `x-bundle-signature-ed25519` | Ed25519 signature (required when `--require-bundle-signature` is enabled) |

```bash
curl -X POST \
  -H "X-API-Key: $KEY" \
  -H "x-function-name: hello" \
  --data-binary @hello.eszip \
  http://localhost:9000/_internal/functions
```

Deploy with a manifest:

```bash
MANIFEST_B64=$(base64 < function.manifest.json)

curl -X POST \
  -H "X-API-Key: $KEY" \
  -H "x-function-name: hello" \
  -H "x-function-manifest-b64: $MANIFEST_B64" \
  --data-binary @hello.eszip \
  http://localhost:9000/_internal/functions
```

If the uploaded bundle contains an embedded manifest (from `thunder bundle --manifest`), the runtime resolves and applies it when the header is absent.

Manifest validation runs in order:

1. JSON decode and parse
2. JSON Schema validation (v2, draft 2020-12)
3. Semantic checks (flavor/routes rules, SSRF deny range validation)

Returns `400 Bad Request` if validation fails.

---

### `GET /_internal/functions/{name}`

Get info for a specific deployed function.

```bash
curl -H "X-API-Key: $KEY" http://localhost:9000/_internal/functions/hello
```

Returns the same function info object described in the list endpoint.

---

### `PUT /_internal/functions/{name}`

Update a deployed function with a new bundle. Same headers as `POST /_internal/functions`.

```bash
curl -X PUT \
  -H "X-API-Key: $KEY" \
  -H "x-function-name: hello" \
  --data-binary @hello-v2.eszip \
  http://localhost:9000/_internal/functions/hello
```

If `x-function-manifest-b64` is provided, the manifest is replaced. If omitted, the existing manifest is preserved.

---

### `DELETE /_internal/functions/{name}`

Delete a deployed function and shut down its isolates.

```bash
curl -X DELETE \
  -H "X-API-Key: $KEY" \
  http://localhost:9000/_internal/functions/hello
```

---

### `POST /_internal/functions/{name}/reload`

Hot reload a function. Re-creates isolates from the current bundle without redeploying. The currently attached manifest is preserved.

```bash
curl -X POST \
  -H "X-API-Key: $KEY" \
  http://localhost:9000/_internal/functions/hello/reload
```

---

### `GET /_internal/functions/{name}/pool`

Get per-function isolate pool limits.

```bash
curl -H "X-API-Key: $KEY" \
  http://localhost:9000/_internal/functions/hello/pool
```

```json
{
  "min": 0,
  "max": 10,
  "current": 2
}
```

### `PUT /_internal/functions/{name}/pool`

Update per-function isolate pool limits. Accepts a JSON body with `min` and/or `max` fields.

```bash
curl -X PUT \
  -H "X-API-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"min": 1, "max": 20}' \
  http://localhost:9000/_internal/functions/hello/pool
```

---

### `GET /_internal/functions/{name}/manifest`

Inspect the currently attached manifest for a function.

```bash
curl -H "X-API-Key: $KEY" \
  http://localhost:9000/_internal/functions/hello/manifest
```

| Status | Meaning |
|--------|---------|
| `200` | Returns the resolved manifest |
| `404` | Function exists but has no manifest, or function not found |

---

## Ingress Routing

Function requests are routed through the **ingress listener** (default port `8080`). The function name is extracted from the first path segment, and the remaining path is forwarded to the handler.

```
GET /my-function/api/users/123
    |            |
    |            +-- Forwarded path: /api/users/123
    +--------------- Function name:  my-function
```

Requests to `/_internal/*` on the ingress listener return `404 Not Found`.

### Reverse Proxy Mapping

When using subdomain-style routing in front of the runtime:

```
External:  https://{function_id}.my-edge.com/api/ping
Runtime:   http://localhost:8080/{function_id}/api/ping
Admin:     http://localhost:9000/_internal/*
```

---

## Endpoint Summary

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/_internal/health` | Health check |
| `GET` | `/_internal/metrics` | Runtime metrics (cached, `?fresh=1` to force) |
| `GET` | `/metrics` | Alias for `/_internal/metrics` |
| `GET` | `/_internal/functions` | List all functions |
| `POST` | `/_internal/functions` | Deploy a new function |
| `GET` | `/_internal/functions/{name}` | Get function info |
| `PUT` | `/_internal/functions/{name}` | Update a function |
| `DELETE` | `/_internal/functions/{name}` | Delete a function |
| `POST` | `/_internal/functions/{name}/reload` | Hot reload a function |
| `GET` | `/_internal/functions/{name}/pool` | Get pool limits |
| `PUT` | `/_internal/functions/{name}/pool` | Update pool limits |
| `GET` | `/_internal/functions/{name}/manifest` | Get attached manifest |
