---
title: "Prerequisites"
---

Before installing or building Thunder, make sure your system meets the requirements below.

## System requirements

Thunder supports the following platforms:

- **Linux** -- x86_64
- **macOS** -- x86_64 (Intel) and aarch64 (Apple Silicon)

## Required tools

### Rust toolchain

Thunder is written in Rust. You need a working Rust toolchain installed via [rustup](https://rustup.rs/):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

The project pins the **stable** channel in its `rust-toolchain.toml`. When you build for the first time, `rustup` will automatically download the correct version along with two required components:

- **rustfmt** -- code formatting
- **clippy** -- linting

You do not need to install these manually; `rustup` handles them based on the toolchain file.

### Cargo

Cargo ships with the Rust toolchain. No separate installation step is needed. It is used to build, test, and run Thunder.

## Optional tools

These are not required to build or run Thunder, but they enable additional workflows.

### Deno CLI

The [Deno CLI](https://deno.land/) is useful if you want to run `deno check` for TypeScript type checking against your edge functions. It is not required at runtime -- Thunder embeds its own V8-based execution engine.

### Docker

Docker is needed only if you want to spin up the optional observability stack (Prometheus, Grafana, etc.) that ships in the repository.

### k6

[k6](https://k6.io/) is a load testing tool. Install it if you plan to run the performance benchmarks included in the project.
