---
title: "TLS Configuration"
description: "Configuring HTTPS for Thunder ingress and admin listeners."
---

Both the ingress and admin listeners in Thunder support HTTPS via TLS certificates. TLS is disabled by default and must be explicitly configured.

---

## Ingress listener TLS

Enable HTTPS on the user-facing ingress listener:

```bash
thunder \
  --tls-cert /etc/thunder/ingress.crt \
  --tls-key /etc/thunder/ingress.key
```

| Flag | Env var | Description |
|---|---|---|
| `--tls-cert` | `EDGE_RUNTIME_TLS_CERT` | Path to the PEM-encoded certificate file (or certificate chain). |
| `--tls-key` | `EDGE_RUNTIME_TLS_KEY` | Path to the PEM-encoded private key file. |

When both flags are provided, the ingress listener serves HTTPS. When neither is provided, it serves plain HTTP.

---

## Admin listener TLS

Enable HTTPS on the admin API listener:

```bash
thunder \
  --admin-tls-cert /etc/thunder/admin.crt \
  --admin-tls-key /etc/thunder/admin.key
```

| Flag | Env var | Description |
|---|---|---|
| `--admin-tls-cert` | `EDGE_RUNTIME_ADMIN_TLS_CERT` | Path to the PEM-encoded certificate file for the admin listener. |
| `--admin-tls-key` | `EDGE_RUNTIME_ADMIN_TLS_KEY` | Path to the PEM-encoded private key file for the admin listener. |

The ingress and admin listeners can use different certificates and can be configured independently. For example, you might use a public CA-signed certificate on ingress and a self-signed certificate on the admin listener (which is typically only reachable from internal networks).

---

## ALPN

Thunder advertises the following ALPN protocols during the TLS handshake:

- `h2` (HTTP/2)
- `http/1.1` (HTTP/1.1)

Clients that support HTTP/2 will negotiate it automatically. HTTP/1.1 remains available as a fallback.

---

## Generating a self-signed certificate for development

For local development and testing, generate a self-signed certificate with OpenSSL:

```bash
openssl req -x509 -newkey rsa:4096 \
  -keyout dev.key -out dev.crt \
  -days 365 -nodes \
  -subj "/CN=localhost"
```

Then start Thunder with the generated files:

```bash
thunder \
  --tls-cert dev.crt \
  --tls-key dev.key \
  --admin-tls-cert dev.crt \
  --admin-tls-key dev.key
```

Clients connecting to this instance will need to trust the self-signed certificate or disable certificate verification (for development only):

```bash
# curl example
curl -k https://localhost:9000/

# Node.js / Deno fetch
NODE_TLS_REJECT_UNAUTHORIZED=0 node client.js
```

---

## Unix socket ingress

When the ingress listener is configured to bind to a Unix domain socket (`--unix-socket`), TLS is **not supported** on that listener. Unix sockets are inherently local and do not traverse the network, so transport encryption is typically unnecessary.

```bash
# Unix socket mode -- TLS flags for ingress are ignored
thunder --unix-socket /var/run/thunder.sock
```

If you need encrypted communication over a Unix socket (uncommon), terminate TLS at a reverse proxy in front of Thunder.

The admin listener is always TCP-based and supports TLS regardless of the ingress listener mode.

---

## Production recommendations

- **Use CA-signed certificates** from a trusted certificate authority (Let's Encrypt, your organization's internal CA, or a commercial CA).
- **Automate certificate renewal**. If using Let's Encrypt, run a renewal agent (certbot, acme.sh) and reload Thunder when certificates change.
- **Separate ingress and admin certificates** if they are exposed on different networks.
- **Terminate TLS at the reverse proxy** if you already have an nginx, Envoy, or Caddy layer in front of Thunder. In this case, Thunder can serve plain HTTP on a loopback or Unix socket, and the proxy handles TLS termination.
- **Pin certificate chains** in the ingress cert file if intermediate certificates are required by your CA. Concatenate them in order: leaf certificate first, then intermediates.

```bash
# Concatenate leaf + intermediate for the cert file
cat leaf.crt intermediate.crt > fullchain.crt
thunder --tls-cert fullchain.crt --tls-key leaf.key
```
