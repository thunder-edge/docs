---
title: "Function Manifest"
description: "Per-function manifest schema for configuring flavor, routes, environment, network, and resource limits."
---

The function manifest declares per-function configuration for the Thunder runtime. It controls the deploy flavor, routing, environment access, network allowlists, and resource limits.

- Schema: `schemas/function-manifest.v2.schema.json`
- JSON Schema draft: 2020-12

## Versioning

The runtime accepts only `manifestVersion: 2`. Payloads with `manifestVersion: 1` are rejected.

```json
{
  "manifestVersion": 2
}
```

---

## Flavors

| Flavor | Description |
|--------|-------------|
| `single` | Single-entrypoint function. Must not define `routes`. |
| `routed-app` | Multi-route application. Must define at least one route. |

---

## Schema Fields

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `manifestVersion` | `2` (integer) | Schema version (must be `2`) |
| `name` | string | Function name/slug |
| `entrypoint` | string | Entry JS/TS file path |
| `flavor` | `"single"` or `"routed-app"` | Deploy flavor |
| `network` | object | Network access policy (required) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `routes` | array | Route table (required for `routed-app`, forbidden for `single`) |
| `env` | object | Environment variable access controls |
| `resources` | object | Isolate resource limits |
| `auth` | object | Authentication preferences |
| `observability` | object | Logging and tracing preferences |
| `profiles` | object | Environment-specific overrides |

---

## `env`

Controls which environment variables the function can access.

| Field | Type | Description |
|-------|------|-------------|
| `allow` | string[] | List of environment variable names the function can read |
| `secretRefs` | string[] | Secret variable names resolved at runtime |

```json
{
  "env": {
    "allow": ["LOG_LEVEL", "API_BASE_URL"],
    "secretRefs": ["APP_SECRET", "DATABASE_URL"]
  }
}
```

---

## `network`

Network access policy enforced per function.

| Field | Type | Description |
|-------|------|-------------|
| `mode` | `"allowlist"` | Network mode (only `allowlist` is supported) |
| `allow` | string[] | List of allowed targets (`host:port` format). Minimum 1 item |

```json
{
  "network": {
    "mode": "allowlist",
    "allow": [
      "api.example.com:443",
      "db.internal.corp:5432"
    ]
  }
}
```

Wildcard (`*`) is not allowed in `network.allow`. Targets that collide with SSRF deny ranges are rejected at deploy time.

### SSRF Deny Ranges

The runtime blocks the following ranges regardless of manifest configuration:

| Range | Description |
|-------|-------------|
| `127.0.0.0/8` | Loopback |
| `10.0.0.0/8` | RFC 1918 private |
| `172.16.0.0/12` | RFC 1918 private |
| `192.168.0.0/16` | RFC 1918 private |
| `169.254.0.0/16` | Link-local / cloud metadata |
| `0.0.0.0/8` | Reserved |
| `::1/128` | IPv6 loopback |
| `fc00::/7` | IPv6 unique local |
| `fe80::/10` | IPv6 link-local |

---

## `resources`

Per-function isolate resource limits. These override the runtime defaults when set.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxHeapMiB` | integer | `128` | Per-isolate heap limit in MiB. `0` = unlimited |
| `cpuTimeMs` | integer | `50000` | Per-request CPU time limit in ms. `0` = unlimited |
| `wallClockTimeoutMs` | integer | `60000` | Per-request wall clock timeout in ms. `0` = unlimited |
| `vfsTotalQuotaBytes` | integer | `10485760` | Writable VFS quota per isolate (10 MiB) |
| `vfsMaxFileBytes` | integer | `5242880` | Max writable file size in VFS (5 MiB) |
| `egressMaxRequestsPerExecution` | integer | -- | Max outbound requests per execution |

```json
{
  "resources": {
    "maxHeapMiB": 256,
    "cpuTimeMs": 30000,
    "wallClockTimeoutMs": 45000,
    "vfsTotalQuotaBytes": 20971520,
    "vfsMaxFileBytes": 10485760
  }
}
```

---

## `routes`

Route table for `routed-app` flavor. Each route is either a function route or an asset route.

### Function Route

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `kind` | `"function"` | yes | Route type |
| `path` | string | yes | URL path prefix (must start with `/`) |
| `entrypoint` | string | yes | JS/TS entrypoint file |
| `methods` | string[] | no | Allowed HTTP methods |

### Asset Route

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `kind` | `"asset"` | yes | Route type |
| `path` | string | yes | URL path prefix (must start with `/`) |
| `assetDir` | string | yes | Directory containing static files |
| `methods` | string[] | no | Only `GET` and `HEAD` are allowed |

```json
{
  "routes": [
    {
      "kind": "function",
      "path": "/api",
      "entrypoint": "./api/index.ts",
      "methods": ["GET", "POST"]
    },
    {
      "kind": "asset",
      "path": "/static",
      "assetDir": "./public"
    }
  ]
}
```

### Validation Rules

- `single` flavor must not define `routes`.
- `routed-app` flavor must define at least one route.
- Function routes require a non-empty `entrypoint` and cannot define `assetDir`.
- Asset routes require a non-empty `assetDir` and cannot define `entrypoint`.
- Asset route `methods`, if provided, can only contain `GET` and `HEAD`.
- Routes are validated for path/method collisions at bundle time. Ambiguous overlaps fail the build.

---

## `auth`

| Field | Type | Description |
|-------|------|-------------|
| `verifyJwt` | boolean | Whether to verify JWT tokens |

```json
{
  "auth": {
    "verifyJwt": true
  }
}
```

---

## `observability`

| Field | Type | Description |
|-------|------|-------------|
| `logLevel` | string | Log level for the function |
| `traceSamplePercent` | integer | Trace sampling percentage (0-100) |

```json
{
  "observability": {
    "logLevel": "info",
    "traceSamplePercent": 10
  }
}
```

---

## `profiles`

Profiles provide environment-specific overrides. Profile names must match `^[a-z][a-z0-9_-]{0,31}$`.

Each profile can override: `env`, `network`, `resources`, `auth`, and `observability`.

```json
{
  "profiles": {
    "staging": {
      "env": {
        "allow": ["LOG_LEVEL", "STAGING_API_URL"],
        "secretRefs": ["STAGING_SECRET"]
      },
      "network": {
        "allow": ["staging-api.example.com:443"]
      },
      "resources": {
        "maxHeapMiB": 64,
        "cpuTimeMs": 10000
      }
    },
    "production": {
      "env": {
        "allow": ["LOG_LEVEL"],
        "secretRefs": ["PROD_SECRET", "DATABASE_URL"]
      },
      "network": {
        "allow": ["api.example.com:443", "db.prod.internal:5432"]
      },
      "resources": {
        "maxHeapMiB": 256,
        "cpuTimeMs": 50000
      }
    }
  }
}
```

Select a profile at deploy time with the `x-function-manifest-profile` header.

---

## Deploy API Integration

When deploying a function via `POST /_internal/functions`, the manifest is provided as a Base64-encoded JSON string in the `x-function-manifest-b64` header.

```bash
MANIFEST_B64=$(base64 < function.manifest.json)

curl -X POST \
  -H "X-API-Key: $KEY" \
  -H "x-function-name: hello" \
  -H "x-function-manifest-b64: $MANIFEST_B64" \
  --data-binary @hello.eszip \
  http://localhost:9000/_internal/functions
```

To select a profile:

```bash
curl -X POST \
  -H "X-API-Key: $KEY" \
  -H "x-function-name: hello" \
  -H "x-function-manifest-b64: $MANIFEST_B64" \
  -H "x-function-manifest-profile: production" \
  --data-binary @hello.eszip \
  http://localhost:9000/_internal/functions
```

If the header is absent but the uploaded bundle contains an embedded manifest (from `thunder bundle --manifest`), the runtime resolves and applies the embedded manifest.

### Validation Pipeline

1. JSON decode / parse
2. JSON Schema validation (v2, draft 2020-12)
3. Semantic checks (flavor/routes rules, SSRF denylist)

If any step fails, the response is `400 Bad Request`.

### Update and Reload Behavior

- `PUT /_internal/functions/{name}`: replaces the manifest if `x-function-manifest-b64` is provided; preserves the existing manifest if omitted.
- `POST /_internal/functions/{name}/reload`: preserves the currently attached manifest.

### Inspecting the Current Manifest

```bash
curl -H "X-API-Key: $KEY" \
  http://localhost:9000/_internal/functions/hello/manifest
```

Returns `200` with the resolved manifest, or `404` if no manifest is attached.

---

## Example: Single Flavor

```json
{
  "$schema": "https://thunder.dev/schemas/function-manifest.v2.schema.json",
  "manifestVersion": 2,
  "name": "hello",
  "entrypoint": "./index.ts",
  "flavor": "single",
  "env": {
    "allow": ["LOG_LEVEL"],
    "secretRefs": ["APP_SECRET"]
  },
  "network": {
    "mode": "allowlist",
    "allow": ["api.example.com:443"]
  },
  "resources": {
    "maxHeapMiB": 128,
    "cpuTimeMs": 50000,
    "wallClockTimeoutMs": 60000
  }
}
```

## Example: Routed App Flavor

```json
{
  "$schema": "https://thunder.dev/schemas/function-manifest.v2.schema.json",
  "manifestVersion": 2,
  "name": "my-app",
  "entrypoint": "./app/main.ts",
  "flavor": "routed-app",
  "network": {
    "mode": "allowlist",
    "allow": ["api.example.com:443", "cdn.example.com:443"]
  },
  "routes": [
    {
      "kind": "function",
      "path": "/api/users",
      "entrypoint": "./app/routes/users.ts",
      "methods": ["GET", "POST"]
    },
    {
      "kind": "function",
      "path": "/api/health",
      "entrypoint": "./app/routes/health.ts",
      "methods": ["GET"]
    },
    {
      "kind": "asset",
      "path": "/static",
      "assetDir": "./public"
    }
  ],
  "env": {
    "allow": ["NODE_ENV"],
    "secretRefs": ["DATABASE_URL"]
  },
  "resources": {
    "maxHeapMiB": 256,
    "cpuTimeMs": 30000,
    "wallClockTimeoutMs": 45000
  },
  "profiles": {
    "staging": {
      "network": {
        "allow": ["staging-api.example.com:443"]
      },
      "resources": {
        "maxHeapMiB": 64
      }
    }
  }
}
```

---

## Watch Mode Note

`thunder watch` deploys functions without attaching a manifest. To use manifest-enforced behavior during development, deploy via the admin endpoint with the `x-function-manifest-b64` header.
