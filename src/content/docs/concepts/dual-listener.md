---
title: "Dual-Listener Architecture"
---

Thunder uses a dual-listener architecture that separates management traffic from function invocation traffic. Two independent HTTP listeners run in the same process and share a single `FunctionRegistry`.

## Architecture Overview

```
                          +-----------------------------------------+
                          |              Thunder Runtime             |
                          |                                         |
  Operators / CI/CD       |   +---------------------------+         |
  (deploy, manage)        |   |     Admin Listener        |         |
  ----------------------->|   |     port 9000 (default)    |         |
  X-API-Key required      |   |                           |         |
                          |   |  /_internal/health         |         |
                          |   |  /_internal/metrics        |         |
                          |   |  /_internal/functions      |         |
                          |   |  /_internal/functions/{n}  |         |
                          |   +-------------+-------------+         |
                          |                 |                        |
                          |                 v                        |
                          |        +--------+--------+               |
                          |        | FunctionRegistry |               |
                          |        |  (shared state)  |               |
                          |        +--------+--------+               |
                          |                 ^                        |
                          |                 |                        |
                          |   +-------------+-------------+         |
  End users / proxies     |   |    Ingress Listener       |         |
  (invoke functions)      |   |    port 8080 (default)    |         |
  ----------------------->|   |    or Unix socket          |         |
  No auth required        |   |                           |         |
                          |   |  /{function_name}/*       |         |
                          |   +---------------------------+         |
                          |                                         |
                          +-----------------------------------------+
```

---

## Admin Listener

The admin listener handles management operations. It is intended for operators, CI/CD pipelines, and monitoring systems -- not for end-user traffic.

**Default binding:** `0.0.0.0:9000`

**Authentication:** When `--api-key` is configured, every request to `/_internal/*` must include an `X-API-Key` header with the matching value. Without it, the request receives a `401 Unauthorized` response. If no API key is set, the admin listener operates in open mode with a startup warning.

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/_internal/health` | GET | Health check. |
| `/_internal/metrics` | GET | Runtime and function metrics. |
| `/metrics` | GET | Alias for metrics (Prometheus-compatible). |
| `/_internal/functions` | GET | List all deployed functions. |
| `/_internal/functions` | POST | Deploy a new function. |
| `/_internal/functions/{name}` | GET | Get function info. |
| `/_internal/functions/{name}` | PUT | Update a function. |
| `/_internal/functions/{name}` | DELETE | Delete a function. |
| `/_internal/functions/{name}/reload` | POST | Hot-reload a function. |
| `/_internal/functions/{name}/pool` | GET | Get pool limits for a function. |
| `/_internal/functions/{name}/pool` | PUT | Update pool limits for a function. |

### Configuration

| Flag | Env Variable | Default |
|------|-------------|---------|
| `--admin-host` | `EDGE_RUNTIME_ADMIN_HOST` | `0.0.0.0` |
| `--admin-port` | `EDGE_RUNTIME_ADMIN_PORT` | `9000` |
| `--api-key` | `EDGE_RUNTIME_API_KEY` | (none -- open mode) |
| `--admin-tls-cert` | `EDGE_RUNTIME_ADMIN_TLS_CERT` | (none) |
| `--admin-tls-key` | `EDGE_RUNTIME_ADMIN_TLS_KEY` | (none) |

---

## Ingress Listener

The ingress listener serves function invocation requests from end users, reverse proxies, or load balancers. It does not require authentication.

**Default binding:** `0.0.0.0:8080` (TCP) or a Unix socket path.

### Routing

The first path segment identifies the function name. The remaining path is forwarded to the function handler.

```
GET /my-function/api/users/123
    |            |
    |            +-- forwarded path: /api/users/123
    +--------------- function name:  my-function
```

Requests to `/_internal/*` on the ingress listener return `404 Not Found`. Management endpoints are only accessible on the admin listener.

### Configuration

| Flag | Env Variable | Default |
|------|-------------|---------|
| `--host` | `EDGE_RUNTIME_HOST` | `0.0.0.0` |
| `--port` | `EDGE_RUNTIME_PORT` | `8080` |
| `--unix-socket` | `EDGE_RUNTIME_UNIX_SOCKET` | (none) |
| `--tls-cert` | `EDGE_RUNTIME_TLS_CERT` | (none) |
| `--tls-key` | `EDGE_RUNTIME_TLS_KEY` | (none) |

`--port` and `--unix-socket` are mutually exclusive. When using a Unix socket, TLS options are ignored (TLS is redundant for local IPC).

---

## Shared FunctionRegistry

Both listeners operate on the same `FunctionRegistry` instance. When you deploy a function through the admin listener, it becomes immediately available on the ingress listener. When you delete a function, it stops serving on both.

This shared-state design means:

- No synchronization delay between deploy and availability.
- Metrics collected on ingress are visible through admin metrics endpoints.
- Pool limits set via admin API take effect on the next ingress request.

---

## Reverse Proxy Mapping

In production, Thunder typically sits behind a reverse proxy (Nginx, Caddy, HAProxy, a cloud load balancer). The proxy maps external URLs to the runtime's ingress listener, preserving the function name as the first path segment.

### Subdomain-Based Routing

A common pattern maps each function to a subdomain:

```
External URL:   https://{func}.my-edge.com/path
                          |
                          v
Runtime URL:    http://localhost:8080/{func}/path
```

Example:

```
https://hello.my-edge.com/api/ping
  -> http://localhost:8080/hello/api/ping
```

### Nginx Example

```nginx
server {
    listen 443 ssl;
    server_name ~^(?<func>[^.]+)\.my-edge\.com$;

    location / {
        proxy_pass http://127.0.0.1:8080/$func$request_uri;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Unix Socket with Nginx

When using a Unix socket for ingress:

```nginx
upstream thunder {
    server unix:/var/run/thunder.sock;
}

server {
    listen 443 ssl;
    server_name ~^(?<func>[^.]+)\.my-edge\.com$;

    location / {
        proxy_pass http://thunder/$func$request_uri;
    }
}
```

---

## Network Separation

The dual-listener design enables network-level separation of concerns:

| Concern | Listener | Typical Network |
|---------|----------|----------------|
| Deploy, update, delete functions | Admin (9000) | Internal / VPN only |
| Health checks, metrics scraping | Admin (9000) | Internal monitoring network |
| End-user function invocation | Ingress (8080) | Public / DMZ |

You can bind the admin listener to a private interface (`--admin-host 127.0.0.1`) while keeping the ingress listener on all interfaces. Combined with API key authentication and TLS, this provides defense in depth for the management plane.

---

## Startup Example

```bash
thunder start \
  --api-key "$(cat /run/secrets/api-key)" \
  --admin-host 127.0.0.1 \
  --admin-port 9000 \
  --host 0.0.0.0 \
  --port 8080 \
  --max-heap-mib 256
```

This configuration:

- Binds the admin listener to localhost only (not reachable from the network).
- Requires an API key for all admin operations.
- Binds the ingress listener to all interfaces on port 8080.
- Sets a 256 MiB heap limit per isolate.
