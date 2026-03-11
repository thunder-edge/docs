---
title: "Bundle Signing"
description: "Verify deployment integrity with Ed25519 bundle signatures."
---

Thunder supports Ed25519 signature verification for function bundles deployed through the admin API. When enabled, the runtime rejects any deploy or update request that does not include a valid signature, ensuring that only authorized bundles can be deployed.

## How it works

1. A CI/CD pipeline or operator signs the exact bundle bytes (`.eszip` or `.pkg`) with an Ed25519 private key.
2. The signed bundle is deployed with the signature in the `x-bundle-signature-ed25519` HTTP header (base64-encoded).
3. The runtime verifies the signature using a configured public key.
4. Only bundles with a valid signature are accepted.

Signature validation happens at deploy/update time on these endpoints:

- `POST /_internal/functions` (deploy)
- `PUT /_internal/functions/{name}` (update)

Already-loaded functions continue running even after key rotation. They are only affected when a new deploy or update is attempted.

## Generating keys

Use OpenSSL 3.x with Ed25519 support.

### 1. Generate the private key

```bash
openssl genpkey -algorithm ED25519 -out bundle-signing-private.pem
```

### 2. Extract the public key

```bash
openssl pkey -in bundle-signing-private.pem -pubout -out bundle-signing-public.pem
```

### 3. Set file permissions

```bash
chmod 600 bundle-signing-private.pem
chmod 644 bundle-signing-public.pem
```

The private key should never be stored on the production runtime host. Keep it only in your build/release pipeline (CI secrets, HSM, or KMS).

## Enabling in the runtime

Start Thunder with signature verification enabled:

```bash
thunder start \
  --require-bundle-signature \
  --bundle-public-key-path ./bundle-signing-public.pem
```

With an API key for the admin listener:

```bash
thunder start \
  --api-key "admin-secret" \
  --require-bundle-signature \
  --bundle-public-key-path /etc/thunder/keys/bundle-signing-public.pem
```

### CLI flags

| Flag | Description |
|------|-------------|
| `--require-bundle-signature` | Require a valid signature on every deploy/update |
| `--bundle-public-key-path <PATH>` | Path to the Ed25519 public key file |

### Environment variables

| Variable | Description |
|----------|-------------|
| `EDGE_RUNTIME_REQUIRE_BUNDLE_SIGNATURE` | Set to `true` to require signatures |
| `EDGE_RUNTIME_BUNDLE_PUBLIC_KEY_PATH` | Path to the public key file |

By default, signature verification is disabled. It becomes mandatory only when `--require-bundle-signature` is set.

## Supported key formats

The `--bundle-public-key-path` file can be in one of these formats:

| Format | Description |
|--------|-------------|
| PEM | `-----BEGIN PUBLIC KEY-----` (recommended) |
| Base64 | Raw 32-byte public key, base64-encoded |
| Hex | Raw 32-byte public key, hex-encoded |

PEM is recommended to reduce operational errors.

## Signing bundles

### Using the included script

The repository includes `scripts/sign-bundle.sh`:

```bash
./scripts/sign-bundle.sh \
  --bundle ./hello.eszip \
  --private-key ./bundle-signing-private.pem \
  --print-header
```

Output:

```
Signed bundle: ./hello.eszip
Signature file: ./hello.eszip.sig
Signature (base64): <base64-encoded-signature>
Header: x-bundle-signature-ed25519: <base64-encoded-signature>
```

Script options:

| Option | Description |
|--------|-------------|
| `--bundle <path>` | Path to the bundle file (required) |
| `--private-key <path>` | Path to Ed25519 private key PEM (required) |
| `--output <path>` | Output signature file (default: `<bundle>.sig`) |
| `--print-header` | Print the `x-bundle-signature-ed25519` header value |

### Manual signing with OpenSSL

Sign the bundle file bytes:

```bash
openssl pkeyutl -sign \
  -inkey bundle-signing-private.pem \
  -rawin \
  -in hello.eszip \
  -out hello.eszip.sig
```

Convert the signature to base64:

```bash
SIG_B64="$(base64 < hello.eszip.sig | tr -d '\n')"
```

## Deploying with a signature

Include the `x-bundle-signature-ed25519` header in your deploy request:

### Deploy (POST)

```bash
curl -X POST http://localhost:9000/_internal/functions \
  -H "x-function-name: hello" \
  -H "x-bundle-signature-ed25519: ${SIG_B64}" \
  --data-binary @./hello.eszip
```

### Update (PUT)

```bash
curl -X PUT http://localhost:9000/_internal/functions/hello \
  -H "x-bundle-signature-ed25519: ${SIG_B64}" \
  --data-binary @./hello.eszip
```

If the runtime is also configured with an API key, include that header too:

```bash
curl -X POST http://localhost:9000/_internal/functions \
  -H "X-API-Key: admin-secret" \
  -H "x-function-name: hello" \
  -H "x-bundle-signature-ed25519: ${SIG_B64}" \
  --data-binary @./hello.eszip
```

## Error responses

When `--require-bundle-signature` is enabled and verification fails:

| Condition | Status | Body |
|-----------|--------|------|
| Missing header | 401 | `{"error":"missing x-bundle-signature-ed25519 header"}` |
| Invalid encoding | 401 | `{"error":"invalid x-bundle-signature-ed25519 encoding"}` |
| Invalid signature | 401 | `{"error":"bundle signature verification failed"}` |

## Key rotation

To rotate keys without downtime:

1. Generate a new key pair.
2. Update the runtime configuration to use the new public key (restart or redeploy the runtime).
3. Update the CI/CD pipeline to sign with the new private key.
4. Validate with a canary deploy.
5. Remove the old private key from the pipeline.

Important considerations:

- Bundles signed with the old key are rejected after the public key is switched.
- Already-deployed functions continue running until a new deploy or restart occurs.
- The key switch requires a runtime restart since the public key is loaded at startup.

## Security best practices

### Private key (signing side)

- Never store it on the production runtime host.
- Keep it only in the build/release pipeline (CI secrets, HSM, or KMS).
- Do not commit it to version control.
- Rotate periodically.
- Audit access and usage.

### Public key (verification side)

- Store it on the runtime host with read-only permissions.
- Recommended path: `/etc/thunder/keys/` with minimal permissions.
- Manage via configuration management (Ansible, Terraform, etc.).

### General recommendations

- Combine bundle signing with TLS and API key authentication on the admin listener.
- Use different key pairs for different environments (dev/staging/prod).
- Keep secure private key backups with a tested recovery process.
- Maintain an incident runbook for emergency key revocation and rotation.
