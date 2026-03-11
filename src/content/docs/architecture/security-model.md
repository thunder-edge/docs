---
title: "Security Model"
description: "Defense-in-depth security architecture of the Thunder edge runtime."
---

Thunder applies a defense-in-depth strategy with multiple independent layers of protection. A breach in any single layer does not compromise the system as a whole.

## Security Layers

### 1. V8 Isolate Sandbox

Every function executes inside its own V8 isolate. V8 isolates provide strong memory isolation -- one isolate cannot read or write the memory of another. Each isolate gets its own heap, global scope, and set of built-in objects. There is no shared mutable state between isolates.

Thunder spawns each isolate on a dedicated OS thread, which means there is also thread-level isolation on top of the V8-level isolation.

### 2. SSRF Protection

All outbound `fetch()` calls pass through a DNS-resolution filter that blocks connections to private and reserved IP ranges. This prevents server-side request forgery (SSRF) attacks where user code attempts to reach internal infrastructure.

#### Protected IP Ranges

| CIDR Block | Description |
|---|---|
| `127.0.0.0/8` | Loopback |
| `10.0.0.0/8` | Private (RFC 1918) |
| `172.16.0.0/12` | Private (RFC 1918) |
| `192.168.0.0/16` | Private (RFC 1918) |
| `169.254.0.0/16` | Link-local |
| `0.0.0.0/8` | "This" network |
| `100.64.0.0/10` | Shared address space (RFC 6598) |
| `192.0.0.0/24` | IETF protocol assignments |
| `192.0.2.0/24` | Documentation (TEST-NET-1) |
| `198.51.100.0/24` | Documentation (TEST-NET-2) |
| `203.0.113.0/24` | Documentation (TEST-NET-3) |
| `198.18.0.0/15` | Benchmarking (RFC 2544) |
| `240.0.0.0/4` | Reserved for future use |
| `::1/128` | IPv6 loopback |
| `fc00::/7` | IPv6 unique local |
| `fe80::/10` | IPv6 link-local |

The filter is applied after DNS resolution, so it catches attempts to use DNS rebinding to map a public hostname to a private IP address.

### 3. API Key Authentication

Admin endpoints (deploy, undeploy, configuration, status) are protected by API key authentication. Every request to the admin listener must include a valid `X-API-Key` header. Requests with a missing or invalid key receive **401 Unauthorized**.

The API key is configured at server startup and is never exposed through any runtime API accessible to function code.

### 4. TLS

Both the ingress and admin listeners support HTTPS through Rustls. The `DynamicTlsAcceptor` allows certificate rotation at runtime without restarting the server. TLS configuration includes:

- TLS 1.2 and 1.3 support
- Configurable cipher suites
- SNI-based certificate selection

### 5. Bundle Signing

Deploy payloads can be cryptographically signed using **Ed25519** signatures. When signature verification is enabled, the server rejects any deploy request whose payload does not match the expected signature. This ensures that only authorized build pipelines can deploy code to the runtime.

The verification key is configured on the server side. The signing key is held by the CI/CD pipeline or deployment tooling and never leaves the build environment.

### 6. Resource Limits

Thunder enforces hard limits on the resources a function can consume. These limits prevent a single function from degrading the performance of the entire runtime.

| Resource | Limit Type | Effect When Exceeded |
|---|---|---|
| V8 heap size | Per-isolate maximum (bytes) | Isolate is terminated |
| CPU time | Per-request maximum (duration) | Isolate execution is cancelled |
| Wall-clock timeout | Per-request maximum (duration) | Watchdog thread terminates isolate; 504 returned |
| Request body size | Per-request maximum (bytes) | Request rejected with 413 |
| Connection concurrency | Per-function semaphore | Excess requests receive 503 |
| Global connection limit | Server-wide semaphore | Excess requests receive 503 |

When a heap or CPU limit is exceeded, the isolate is terminated and discarded. It is not returned to the pool.

### 7. VFS Sandboxing

Function code has **no access to the host filesystem**. There is no `Deno.readFile`, `Deno.writeFile`, or any other file-system API exposed to user code. The only files available to a function are those included in its ESZIP bundle, served through a read-only virtual file system.

This eliminates an entire class of path-traversal and file-exfiltration attacks.

### 8. Global Freezing

After the bootstrap phase and before user code executes, Thunder freezes critical global objects and their prototypes. This includes objects such as `Object`, `Array`, `Function`, `Promise`, and the Web API globals.

Freezing prevents **prototype pollution** attacks where user code modifies shared prototypes to inject behavior into other code paths. Because the prototypes are frozen with `Object.freeze()`, any attempt to add, modify, or delete properties on them throws a `TypeError`.

### 9. Network Manifest

Each function can be deployed with a **network manifest** -- an allowlist of hostnames and IP ranges that the function is permitted to contact via `fetch()`. Outbound requests to destinations not on the allowlist are blocked.

This provides a least-privilege network policy on top of the SSRF protection. Even if a destination is a public IP (and therefore not blocked by the SSRF filter), it will still be rejected unless it appears in the function's network manifest.

## Summary

The following table maps each layer to the threat it mitigates:

| Layer | Threat Mitigated |
|---|---|
| V8 Isolate Sandbox | Cross-function data leakage, memory corruption |
| SSRF Protection | Internal network scanning, metadata service access |
| API Key Authentication | Unauthorized deploys and configuration changes |
| TLS | Eavesdropping, man-in-the-middle attacks |
| Bundle Signing | Tampered or unauthorized code deployment |
| Resource Limits | Denial of service, resource exhaustion |
| VFS Sandboxing | Path traversal, file exfiltration |
| Global Freezing | Prototype pollution, global scope tampering |
| Network Manifest | Unauthorized outbound data exfiltration |
