---
title: "Production Checklist"
description: "Pre-launch checklist for deploying Thunder in production."
---

Before exposing a Thunder instance to production traffic, walk through every item below. Each entry links to the relevant documentation section for details.

---

## Security

### 1. Set an API key for the admin API

The admin listener exposes function deployment, configuration, and lifecycle endpoints. Always require authentication.

```bash
thunder --api-key "$(openssl rand -hex 32)"
```

Without `--api-key`, the admin API is open to any client that can reach the admin port.

### 2. Enable TLS on both listeners

Serve HTTPS on the ingress and admin listeners. See [TLS Configuration](/docs/deployment/tls/) for flag details.

```bash
thunder \
  --tls-cert /etc/thunder/ingress.crt --tls-key /etc/thunder/ingress.key \
  --admin-tls-cert /etc/thunder/admin.crt --admin-tls-key /etc/thunder/admin.key
```

### 3. Enable SSRF protection

SSRF protection is **enabled by default**. Verify that it has not been explicitly disabled. When enabled, outbound `fetch()` calls to private/internal IP ranges (RFC 1918, loopback, link-local) are blocked.

```bash
# Do NOT set this in production
# --disable-ssrf-protection
```

If specific internal endpoints must be reachable, use `--allow-private-net <cidr>` to allowlist them explicitly.

### 4. Consider bundle signing

For supply-chain integrity, require that deployed bundles are signed with a trusted key.

```bash
thunder \
  --require-bundle-signature \
  --bundle-public-key-path /etc/thunder/bundle-signing.pub
```

---

## Body and connection limits

### 5. Configure body size limits

Set request and response body limits appropriate for your workloads.

```bash
thunder \
  --max-request-body-size 5242880 \
  --max-response-body-size 10485760
```

See [Resource Limits](/docs/platform/resource-limits/) for defaults and behaviour.

### 6. Configure connection limits

Cap concurrent connections and optionally enable rate limiting.

```bash
thunder \
  --max-connections 10000 \
  --rate-limit 5000
```

---

## Resource limits

### 7. Set appropriate isolate resource limits

Tune heap, CPU time, and wall-clock limits for your function workloads.

```bash
thunder \
  --max-heap-mib 128 \
  --cpu-time-limit-ms 50000 \
  --wall-clock-timeout-ms 60000
```

Conservative defaults are provided, but production workloads may require adjustment. See [Resource Limits](/docs/platform/resource-limits/) for guidance.

---

## Networking

### 8. Set up a reverse proxy

Thunder handles function execution. Place a reverse proxy (nginx, Envoy, Caddy) in front for:

- Subdomain-based routing to different function endpoints.
- External TLS termination if preferred.
- Request filtering and WAF integration.
- Load balancing across multiple Thunder instances.

Example nginx upstream:

```nginx
upstream thunder {
    server 127.0.0.1:9000;
}

server {
    listen 443 ssl;
    server_name *.functions.example.com;

    location / {
        proxy_pass http://thunder;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Observability

### 9. Configure OpenTelemetry

Enable OTEL export for traces, metrics, and logs.

```bash
thunder \
  --otel-enabled \
  --otel-endpoint "http://otel-collector:4317" \
  --otel-service-name "thunder-prod" \
  --otel-protocol grpc
```

See [Environment Variables](/docs/deployment/environment-variables/) for the full list of OTEL settings.

### 10. Set up health checks

Point your load balancer or orchestrator health checks at the internal health endpoint:

```
GET /_internal/health
```

This endpoint returns `200 OK` when the server is ready to accept requests. Use it for:

- Kubernetes `livenessProbe` and `readinessProbe`.
- Load balancer health checks.
- Monitoring and alerting.

---

## Lifecycle

### 11. Configure graceful shutdown timeout

When the process receives `SIGTERM`, Thunder stops accepting new connections and drains in-flight requests. Set a timeout that matches your orchestrator's termination grace period.

```bash
thunder --graceful-shutdown-timeout-ms 30000
```

Ensure the orchestrator's grace period is longer than this value to avoid forced kills during drain.

### 12. Review and tune isolate pool settings

The isolate pool determines how many isolates are kept warm and how quickly cold starts are absorbed. Tune for your traffic profile.

```bash
thunder \
  --pool-enabled \
  --pool-global-max-isolates 256 \
  --pool-min-free-memory-mib 512
```

See [Scaling](/docs/deployment/scaling/) for autoscaling signals and pool configuration.

---

## Summary

| Item | Flag / Config | Default | Action |
|---|---|---|---|
| Admin API key | `--api-key` | None (open) | Set a strong random key. |
| Ingress TLS | `--tls-cert`, `--tls-key` | Disabled | Provide cert and key. |
| Admin TLS | `--admin-tls-cert`, `--admin-tls-key` | Disabled | Provide cert and key. |
| Request body limit | `--max-request-body-size` | 5 MiB | Review for your workloads. |
| Response body limit | `--max-response-body-size` | 10 MiB | Review for your workloads. |
| Max connections | `--max-connections` | 10000 | Tune for expected concurrency. |
| Heap limit | `--max-heap-mib` | 128 MiB | Increase for memory-heavy functions. |
| CPU time limit | `--cpu-time-limit-ms` | 50000 ms | Adjust for CPU-heavy functions. |
| Wall-clock timeout | `--wall-clock-timeout-ms` | 60000 ms | Match expected latency budgets. |
| SSRF protection | Enabled by default | On | Do not disable. |
| Bundle signing | `--require-bundle-signature` | Off | Enable for supply-chain security. |
| OTEL | `--otel-enabled` | Off | Enable for production observability. |
| Health check | `/_internal/health` | Always available | Configure in load balancer. |
| Graceful shutdown | `--graceful-shutdown-timeout-ms` | -- | Match orchestrator grace period. |
| Isolate pool | `--pool-global-max-isolates` | 256 | Tune for traffic volume. |
