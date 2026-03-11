---
title: "Running Tests"
---

Thunder has two categories of tests: **Rust tests** (unit, integration, and E2E tests written in Rust) and **JS/TS tests** (TypeScript test suites executed by the built-in test runner inside V8 isolates).

## Quick reference

| Command | What it runs |
|---|---|
| `make test` | Fast Rust tests + JS/TS tests (skips server E2E). |
| `make test-full` | Full Rust suite + JS/TS tests. |
| `make test-js` | JS/TS tests only. |
| `make test-rust-fast` | Fast Rust tests only (skips E2E and stress tests). |
| `make test-rust-full` | Full Rust test suite. |

## Rust tests

### Full workspace

```bash
cargo test
```

This runs every test in every crate, including E2E tests in `edge-server` that start a real HTTP listener. It can take a few minutes.

### Fast development loop (skip E2E)

```bash
cargo test-dev
```

This is a cargo alias defined in `.cargo/config.toml`. It runs the entire workspace but **excludes** the `edge-server` crate and skips any test whose name contains `e2e` or `stress_`. Use this for rapid iteration.

### Full suite

```bash
cargo test-full
```

Runs `cargo test --workspace` with no exclusions.

### Server E2E only

```bash
cargo test-server-e2e
```

Runs only the E2E tests in the `edge-server` crate with `--nocapture` for full output. Use this when you are working on ingress or admin API routes.

### Per-crate testing

You can test individual crates in isolation:

```bash
cargo test -p runtime-core
cargo test -p functions
cargo test -p edge-server
cargo test -p edge-cli
```

### Running a specific test

```bash
cargo test -p runtime-core test_name_substring
```

Add `-- --nocapture` if you need to see `println!` / `tracing` output:

```bash
cargo test -p runtime-core test_name_substring -- --nocapture
```

## JS/TS tests

The JS/TS test suite uses Thunder's built-in test runner, which discovers and executes `.ts` test files inside V8 isolates.

### Run all JS/TS tests

```bash
make test-js
```

This is equivalent to:

```bash
cargo run -- test --path "./tests/js/**/*.ts" --ignore "./tests/js/lib/**"
```

The `--ignore` flag excludes shared library files under `tests/js/lib/` that are imported by test files but are not test suites themselves.

### Run a single test file

```bash
cargo run -- test --path "./tests/js/web_apis_full.test.ts"
```

### Available test files

The `tests/js/` directory contains the following test suites:

| File | Coverage area |
|---|---|
| `web_apis_full.test.ts` | Full Web API surface (fetch, URL, Headers, streams, etc.). |
| `web_apis_partial_and_none.test.ts` | Partially implemented and unimplemented Web APIs. |
| `web_apis_none_deterministic.test.ts` | Non-deterministic Web APIs (crypto random, Date.now). |
| `web_platform_additional.test.ts` | Additional Web Platform APIs. |
| `web_standards_report_regression.test.ts` | Regression tests for the web standards report. |
| `crypto_and_timers.test.ts` | Web Crypto API and timer functions. |
| `js_builtins_and_collections.test.ts` | JS built-ins (Map, Set, Proxy, Reflect, etc.). |
| `language_engine_compat.test.ts` | Language engine compatibility (generators, async iterators, etc.). |
| `networking_tcp_patterns.test.ts` | Networking and TCP patterns. |
| `requested_items_compat.test.ts` | Requested item compatibility checks. |
| `runner_advanced_features.test.ts` | Test runner advanced features (describe, it, hooks). |
| `mocking_system.test.ts` | Built-in mocking system. |

## Test patterns in Rust

Thunder's Rust tests follow two main archetypes.

### Archetype A -- Lightweight JS execution

Tests that need to run a small piece of JavaScript without a full HTTP lifecycle. These create a `JsRuntime` directly, load a script, and assert on the output or return value. Commonly found in `runtime-core`.

```rust
#[test]
fn test_console_log() {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();
    std::thread::spawn(move || {
        rt.block_on(async {
            // Create isolate, run JS, check output
        });
    })
    .join()
    .unwrap();
}
```

The `std::thread::spawn` wrapper is required because `JsRuntime` is `!Send` -- it must stay on the thread where it was created.

### Archetype B -- Full isolate lifecycle

Tests that exercise the complete request-handling path: function registration, isolate pool allocation, HTTP request dispatch through the handler, and response validation. Found primarily in `functions` and `edge-server`.

These tests typically start a real Hyper server on a random port, send HTTP requests, and assert on status codes, headers, and response bodies.

### Self-contained test files

Each Rust test file in Thunder is **self-contained**: helper functions (isolate builders, request factories, assertion utilities) are duplicated within each test module rather than extracted into a shared test crate. This is intentional -- it avoids coupling between test files and makes each file independently understandable.
