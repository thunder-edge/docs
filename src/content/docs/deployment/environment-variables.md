---
title: "Environment Variables"
description: "Complete reference for all EDGE_RUNTIME_* environment variables in Thunder."
---

All Thunder configuration can be set via environment variables prefixed with `EDGE_RUNTIME_`. Environment variables take the lowest precedence -- CLI flags override them, and manifest-level settings override both where applicable.

---

## Admin listener

| Variable | CLI flag | Default | Description |
|---|---|---|---|
| `EDGE_RUNTIME_ADMIN_HOST` | `--admin-host` | `127.0.0.1` | Bind address for the admin API listener. |
| `EDGE_RUNTIME_ADMIN_PORT` | `--admin-port` | `9001` | Port for the admin API listener. |
| `EDGE_RUNTIME_API_KEY` | `--api-key` | None | Shared secret for admin API authentication. Sent as `Authorization: Bearer <key>`. |
| `EDGE_RUNTIME_ADMIN_TLS_CERT` | `--admin-tls-cert` | None | Path to TLS certificate file for the admin listener. |
| `EDGE_RUNTIME_ADMIN_TLS_KEY` | `--admin-tls-key` | None | Path to TLS private key file for the admin listener. |

---

## Ingress listener

| Variable | CLI flag | Default | Description |
|---|---|---|---|
| `EDGE_RUNTIME_HOST` | `--host` | `0.0.0.0` | Bind address for the ingress (user-facing) listener. |
| `EDGE_RUNTIME_PORT` | `--port` | `9000` | Port for the ingress listener. |
| `EDGE_RUNTIME_UNIX_SOCKET` | `--unix-socket` | None | Path to a Unix domain socket. When set, the ingress listener binds to this socket instead of TCP. |
| `EDGE_RUNTIME_TLS_CERT` | `--tls-cert` | None | Path to TLS certificate file for the ingress listener. |
| `EDGE_RUNTIME_TLS_KEY` | `--tls-key` | None | Path to TLS private key file for the ingress listener. |

---

## Isolate resource limits

| Variable | CLI flag | Default | Description |
|---|---|---|---|
| `EDGE_RUNTIME_MAX_HEAP_MIB` | `--max-heap-mib` | `128` | Maximum V8 heap size per isolate in MiB. |
| `EDGE_RUNTIME_CPU_TIME_LIMIT_MS` | `--cpu-time-limit-ms` | `50000` | Maximum CPU time per isolate in milliseconds. |
| `EDGE_RUNTIME_WALL_CLOCK_TIMEOUT_MS` | `--wall-clock-timeout-ms` | `60000` | Maximum wall-clock time per request in milliseconds. |
| `EDGE_RUNTIME_VFS_TOTAL_QUOTA_BYTES` | `--vfs-total-quota-bytes` | `10485760` | Total writable bytes in `/tmp` per isolate. |
| `EDGE_RUNTIME_VFS_MAX_FILE_BYTES` | `--vfs-max-file-bytes` | `5242880` | Maximum size of a single file in `/tmp`. |

---

## Security

| Variable | CLI flag | Default | Description |
|---|---|---|---|
| `EDGE_RUNTIME_DISABLE_SSRF_PROTECTION` | `--disable-ssrf-protection` | `false` | Set to `true` to allow outbound requests to private/internal IP ranges. Not recommended for production. |
| `EDGE_RUNTIME_ALLOW_PRIVATE_NET` | `--allow-private-net` | None | Comma-separated list of CIDR ranges to allow even when SSRF protection is enabled. Example: `10.0.0.0/8,172.16.0.0/12`. |
| `EDGE_RUNTIME_REQUIRE_BUNDLE_SIGNATURE` | `--require-bundle-signature` | `false` | Require that deployed bundles are signed. |
| `EDGE_RUNTIME_BUNDLE_PUBLIC_KEY_PATH` | `--bundle-public-key-path` | None | Path to the public key file used to verify bundle signatures. |

---

## Body size limits

| Variable | CLI flag | Default | Description |
|---|---|---|---|
| `EDGE_RUNTIME_MAX_REQUEST_BODY_SIZE` | `--max-request-body-size` | `5242880` | Maximum request body size in bytes (5 MiB). |
| `EDGE_RUNTIME_MAX_RESPONSE_BODY_SIZE` | `--max-response-body-size` | `10485760` | Maximum response body size in bytes (10 MiB). |

---

## Connection limits

| Variable | CLI flag | Default | Description |
|---|---|---|---|
| `EDGE_RUNTIME_MAX_CONNECTIONS` | `--max-connections` | `10000` | Maximum concurrent TCP connections on the ingress listener. |
| `EDGE_RUNTIME_RATE_LIMIT` | `--rate-limit` | `0` (unlimited) | Maximum requests per second. `0` disables rate limiting. |

---

## Outbound proxy

| Variable | CLI flag | Default | Description |
|---|---|---|---|
| `EDGE_RUNTIME_HTTP_OUTGOING_PROXY` | `--http-outgoing-proxy` | None | HTTP proxy URL for outbound HTTP requests. Example: `http://proxy:3128`. |
| `EDGE_RUNTIME_HTTPS_OUTGOING_PROXY` | `--https-outgoing-proxy` | None | HTTP proxy URL for outbound HTTPS requests (CONNECT tunneling). |
| `EDGE_RUNTIME_TCP_OUTGOING_PROXY` | `--tcp-outgoing-proxy` | None | SOCKS5 or HTTP CONNECT proxy for outbound TCP connections. |
| `EDGE_RUNTIME_HTTP_NO_PROXY` | `--http-no-proxy` | None | Comma-separated list of hosts/domains to bypass the HTTP proxy. |
| `EDGE_RUNTIME_HTTPS_NO_PROXY` | `--https-no-proxy` | None | Comma-separated list of hosts/domains to bypass the HTTPS proxy. |
| `EDGE_RUNTIME_TCP_NO_PROXY` | `--tcp-no-proxy` | None | Comma-separated list of hosts/domains to bypass the TCP proxy. |

---

## Isolate pool

| Variable | CLI flag | Default | Description |
|---|---|---|---|
| `EDGE_RUNTIME_POOL_ENABLED` | `--pool-enabled` | `true` | Enable the isolate pool. When disabled, a fresh isolate is created per request. |
| `EDGE_RUNTIME_POOL_GLOBAL_MAX_ISOLATES` | `--pool-global-max-isolates` | `256` | Maximum number of live isolates across all functions. |
| `EDGE_RUNTIME_POOL_MIN_FREE_MEMORY_MIB` | `--pool-min-free-memory-mib` | None | Minimum free system memory in MiB. The pool evicts idle isolates to maintain this threshold. |

---

## Context pool

| Variable | CLI flag | Default | Description |
|---|---|---|---|
| `EDGE_RUNTIME_CONTEXT_POOL_ENABLED` | `--context-pool-enabled` | `false` | Enable context pooling within isolates for request-level isolation. |
| `EDGE_RUNTIME_MAX_CONTEXTS_PER_ISOLATE` | `--max-contexts-per-isolate` | `10` | Maximum V8 contexts per isolate when context pooling is enabled. |
| `EDGE_RUNTIME_MAX_ACTIVE_REQUESTS_PER_CONTEXT` | `--max-active-requests-per-context` | `1` | Maximum concurrent requests per context. |

---

## OpenTelemetry

| Variable | CLI flag | Default | Description |
|---|---|---|---|
| `EDGE_RUNTIME_OTEL_ENABLED` | `--otel-enabled` | `false` | Enable OpenTelemetry export. |
| `EDGE_RUNTIME_OTEL_ENDPOINT` | `--otel-endpoint` | `http://localhost:4317` | OTEL collector endpoint URL. |
| `EDGE_RUNTIME_OTEL_SERVICE_NAME` | `--otel-service-name` | `thunder` | Service name reported in OTEL telemetry. |
| `EDGE_RUNTIME_OTEL_PROTOCOL` | `--otel-protocol` | `grpc` | Export protocol: `grpc` or `http`. |
| `EDGE_RUNTIME_OTEL_TRACES_ENABLED` | `--otel-traces-enabled` | `true` | Enable trace export (when OTEL is enabled). |
| `EDGE_RUNTIME_OTEL_METRICS_ENABLED` | `--otel-metrics-enabled` | `true` | Enable metrics export (when OTEL is enabled). |
| `EDGE_RUNTIME_OTEL_LOGS_ENABLED` | `--otel-logs-enabled` | `true` | Enable log export (when OTEL is enabled). |
| `EDGE_RUNTIME_OTEL_TRACES_SAMPLE_RATE` | `--otel-traces-sample-rate` | `1.0` | Trace sampling rate between 0.0 and 1.0. |

---

## Other

| Variable | CLI flag | Default | Description |
|---|---|---|---|
| `EDGE_RUNTIME_LOG_FORMAT` | `--log-format` | `json` | Log output format: `json` or `text`. |
| `EDGE_RUNTIME_PRINT_ISOLATE_LOGS` | `--print-isolate-logs` | `false` | Print `console.*` output from isolates to the server log. Useful for development. |
| `EDGE_RUNTIME_SOURCE_MAP` | `--source-map` | `false` | Enable source map support for stack traces. |
| `EDGE_RUNTIME_DNS_DOH_ENDPOINT` | `--dns-doh-endpoint` | `https://cloudflare-dns.com/dns-query` | DNS-over-HTTPS endpoint for `node:dns` resolution. |
| `EDGE_RUNTIME_GRACEFUL_SHUTDOWN_TIMEOUT_MS` | `--graceful-shutdown-timeout-ms` | `30000` | Time to wait for in-flight requests to complete during shutdown. |

---

## Precedence

Configuration values are resolved in this order (highest to lowest precedence):

1. **CLI flags** -- `--max-heap-mib 256`
2. **Environment variables** -- `EDGE_RUNTIME_MAX_HEAP_MIB=256`
3. **Built-in defaults**

Function-level overrides in the deployment manifest can further override server-level defaults for per-isolate settings (heap, CPU, timeout, VFS quotas).
