---
title: "Bundling"
---

Before a function can be deployed to Thunder, its source code and dependencies must be packaged into a single deployable artifact. The `thunder bundle` command handles this process, producing either an ESZIP package or a V8 snapshot bundle.

## Bundle Formats

Thunder supports two bundle formats:

### ESZIP

ESZIP is the default format. It packages JavaScript/TypeScript source modules and their dependency graph into a single binary file. At deploy time, the runtime deserializes the ESZIP, evaluates the modules, and starts serving requests.

```bash
thunder bundle --entrypoint ./src/index.ts --output ./bundle.eszip
```

ESZIP bundles are portable across Thunder versions and V8 engine updates. They are the safer choice when you need maximum compatibility.

### Snapshot

The snapshot format creates a V8 heap snapshot -- a serialized image of the V8 isolate after the module has been evaluated. On cold start, the runtime restores the snapshot directly into memory instead of parsing and evaluating JavaScript, resulting in faster startup times.

```bash
thunder bundle --entrypoint ./src/index.ts --output ./bundle.snapshot --format snapshot
```

Every snapshot bundle includes an embedded ESZIP fallback. If the V8 version that created the snapshot does not match the V8 version running in the target runtime, Thunder automatically falls back to ESZIP-based startup. This ensures availability even during rolling upgrades where runtime versions may differ.

When a V8 version mismatch is detected, the runtime logs a warning. Regenerate snapshot bundles with the current runtime to restore fast cold starts.

### Format Comparison

| Property | ESZIP | Snapshot |
|----------|-------|----------|
| Cold-start speed | Standard | Faster (V8 heap restore) |
| Portability | High (V8-version independent) | Requires matching V8 version |
| Fallback | -- | Embedded ESZIP fallback |
| File size | Smaller | Larger (includes heap image + ESZIP) |
| Default format | Yes | No |

---

## Bundle Command

### Basic Usage

```bash
thunder bundle --entrypoint <FILE> --output <FILE> [--format <eszip|snapshot>]
```

### Options

| Flag | Short | Description |
|------|-------|-------------|
| `--entrypoint` | `-e` | Entrypoint JS/TS file (required). |
| `--output` | `-o` | Output file path (required). |
| `--format` | | `eszip` (default) or `snapshot`. |
| `--manifest` | | Path to a function manifest (v2) to embed. |

### TypeScript Validation

For TypeScript entrypoints (`.ts`, `.mts`, `.cts`, `.tsx`), the bundle command runs `deno check` if the Deno CLI is available in `PATH`. If Deno is not installed, it falls back to syntax and module-graph validation only. Full type checking is recommended for production builds.

---

## Manifest Embedding

A function manifest defines per-function configuration: environment variables, network allowlists, resource limits, and routing rules. You can embed the manifest directly into the bundle artifact so that it travels with the code.

```bash
thunder bundle \
  --entrypoint ./src/index.ts \
  --manifest ./manifest.json \
  --output ./bundle.eszip
```

When a bundle with an embedded manifest is deployed via the admin API, the runtime extracts and applies the manifest automatically. There is no need to send the manifest separately via the `x-function-manifest-b64` header (though you can still override it that way if needed).

### Routed-App Auto-Scan

When the manifest uses `flavor: "routed-app"` and `routes` is empty, the bundle command auto-scans a `functions/` directory relative to the manifest and populates routes based on the file structure. If a sibling `public/` directory exists, static asset routes are generated automatically.

---

## Bundle Signing

Thunder supports Ed25519 bundle signing for integrity verification. When enabled on the runtime (`--require-bundle-signature`), every deploy and update request must include a valid signature. Unsigned or tampered bundles are rejected.

### Signing Workflow

1. **Generate a key pair:**

   ```bash
   openssl genpkey -algorithm ED25519 -out bundle-signing-private.pem
   openssl pkey -in bundle-signing-private.pem -pubout -out bundle-signing-public.pem
   ```

2. **Sign the bundle:**

   ```bash
   openssl pkeyutl -sign \
     -inkey bundle-signing-private.pem \
     -rawin \
     -in ./bundle.eszip \
     -out ./bundle.eszip.sig
   ```

3. **Deploy with signature:**

   ```bash
   SIG_B64="$(base64 < ./bundle.eszip.sig | tr -d '\n')"

   curl -X POST http://127.0.0.1:9000/_internal/functions \
     -H "X-API-Key: admin-secret" \
     -H "x-function-name: my-function" \
     -H "x-bundle-signature-ed25519: ${SIG_B64}" \
     --data-binary @./bundle.eszip
   ```

### Runtime Configuration

| Flag | Env Variable | Description |
|------|-------------|-------------|
| `--require-bundle-signature` | `EDGE_RUNTIME_REQUIRE_BUNDLE_SIGNATURE` | Reject unsigned bundles. |
| `--bundle-public-key-path` | `EDGE_RUNTIME_BUNDLE_PUBLIC_KEY_PATH` | Path to Ed25519 public key (PEM, base64, or hex). |

### Key Management

- Keep the private key in your CI/CD pipeline or HSM. Never store it on the runtime host.
- The public key can reside on the runtime host at a read-only path (e.g., `/etc/thunder/keys/`).
- Rotate keys periodically. After switching the public key on the runtime, new deploys must use the matching private key. Already-running functions are not affected until they are redeployed.

---

## Examples

### Basic ESZIP Bundle

```bash
thunder bundle \
  --entrypoint ./src/index.ts \
  --output ./dist/my-function.eszip
```

### Snapshot Bundle

```bash
thunder bundle \
  --entrypoint ./src/index.ts \
  --output ./dist/my-function.snapshot \
  --format snapshot
```

### Bundle with Manifest

```bash
thunder bundle \
  --entrypoint ./src/index.ts \
  --manifest ./manifest.json \
  --output ./dist/my-function.eszip
```

### Full Production Pipeline

```bash
# 1. Bundle with manifest
thunder bundle \
  --entrypoint ./src/index.ts \
  --manifest ./manifest.json \
  --output ./dist/my-function.eszip

# 2. Sign the bundle
openssl pkeyutl -sign \
  -inkey /secrets/bundle-signing-private.pem \
  -rawin \
  -in ./dist/my-function.eszip \
  -out ./dist/my-function.eszip.sig

# 3. Deploy with signature
SIG_B64="$(base64 < ./dist/my-function.eszip.sig | tr -d '\n')"

curl -X POST https://admin.my-edge.com:9000/_internal/functions \
  -H "X-API-Key: ${ADMIN_API_KEY}" \
  -H "x-function-name: my-function" \
  -H "x-bundle-signature-ed25519: ${SIG_B64}" \
  --data-binary @./dist/my-function.eszip
```
