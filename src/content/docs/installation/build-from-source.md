---
title: "Build from Source"
---

This guide walks through building Thunder from a local checkout of the repository. Make sure you have the [prerequisites](/installation/prerequisites/) installed before continuing.

## Clone the repository

```bash
git clone https://github.com/thunder-edge/docs.git
cd deno-edge-runtime
```

## Build with Cargo

### Debug build

A debug build compiles faster and includes debug symbols, which is ideal for day-to-day development:

```bash
cargo build
```

The binary is written to `target/debug/thunder`.

### Release build

A release build enables full optimizations. Use this when benchmarking or producing a binary for deployment:

```bash
cargo build --release
```

The binary is written to `target/release/thunder`.

## Build with Make

The repository includes a `Makefile` with common shortcuts:

```bash
# Debug build
make build

# Release build (also copies binary to ./thunder)
make release

# Release build + copy to /usr/local/bin
make install
```

## Run directly with Cargo

During development you can skip the explicit build step and run Thunder in one command:

```bash
cargo run -- start
```

Any arguments after `--` are forwarded to the Thunder binary.

## Cargo aliases

The project defines several Cargo aliases in `.cargo/config.toml` for running tests:

| Alias | Description |
|---|---|
| `cargo test-dev` | Fast local loop -- runs workspace tests but skips long E2E and stress tests. |
| `cargo test-full` | Full Rust test suite across the entire workspace. |
| `cargo test-server-e2e` | Runs only the server E2E tests (useful when working on ingress or admin paths). |

## A note about V8 compilation

Thunder depends on `rusty_v8`, which bundles the V8 JavaScript engine. On the first build, Cargo downloads a prebuilt V8 static library from the [rusty_v8 releases mirror](https://github.com/denoland/rusty_v8/releases). If a prebuilt binary is not available for your platform, V8 will be compiled from source, which can take a significant amount of time (30 minutes or more depending on your hardware). Subsequent builds reuse the cached artifact and are much faster.
