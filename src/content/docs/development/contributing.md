---
title: "Contributing"
---

Thank you for your interest in contributing to Thunder. This guide explains the workflow, conventions, and technical constraints you should know before submitting a patch.

## Getting started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:

```bash
git clone https://github.com/<your-user>/deno-edge-runtime.git
cd deno-edge-runtime
```

3. **Create a branch** for your change:

```bash
git checkout -b feat/my-change
```

4. **Build** the project to make sure everything compiles:

```bash
cargo build
```

5. **Run the test suite** before pushing (see [Running Tests](/docs/development/running-tests/)):

```bash
make test
```

6. **Submit a pull request** targeting the `main` branch.

## Code style

Thunder targets **Rust stable** (the exact version is pinned in `rust-toolchain.toml`). Every pull request is expected to pass `rustfmt` and `clippy` without warnings:

```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
```

For TypeScript and JavaScript code (examples, tests, bootstrap scripts), follow the existing patterns in the repository. There is no separate linter configuration -- consistency with existing files is the rule.

## Project layout

There is **no `package.json`** in this repository. Thunder is a pure Rust workspace with four crates (`runtime-core`, `functions`, `server`, `cli`). JavaScript and TypeScript files -- bootstrap scripts, Node.js polyfills, runtime shims, and the built-in test runner -- are embedded directly into the Rust binary at compile time.

See [Project Structure](/docs/development/project-structure/) for the full directory layout.

## Key technical consideration: V8 JsRuntime is !Send

The V8 `JsRuntime` type from `deno_core` is **`!Send`** -- it cannot be moved across OS threads. This is a fundamental constraint that shapes the entire architecture:

- Each V8 isolate lives on a **dedicated OS thread** for its entire lifetime.
- Async work inside the isolate uses `tokio::LocalSet` rather than the multi-threaded Tokio runtime.
- You must never attempt to `Send` a `JsRuntime`, an isolate handle, or any borrowed V8 scope across a thread boundary.
- When writing tests that create isolates, each test spawns its own thread (see `std::thread::spawn` patterns in the test files).

If your change touches isolate creation, the module loader, or the extension system, pay special attention to thread-safety boundaries.

## CI pipeline

Every pull request runs the following pipeline defined in `.github/workflows/ci-cd.yml`:

| Stage | What it does |
|---|---|
| **build_ci** | Compiles the CLI binary and prebuilds all test targets (`--no-run`) to warm the cache. |
| **test_rust_crates** | Runs `cargo test -p <crate>` for each of the four crates (`runtime-core`, `functions`, `edge-server`, `edge-cli`) in parallel. |
| **test_js** | Executes the full JS/TS test suite via `make test-js`. |
| **verify_web_standards_report** | Regenerates the web standards API report and fails if it is out of date. |
| **build_release_artifacts** | Builds release binaries for Linux x86_64, macOS x86_64, and macOS aarch64 (runs only on `main` or version tags). |

All stages must pass before a pull request can be merged.

## Commit messages

Write clear, descriptive commit messages. Prefer a short imperative summary line (50 characters or fewer) followed by a blank line and an optional body explaining the motivation for the change.

## Reporting issues

If you find a bug or have a feature request, open an issue on GitHub with:

- A clear description of the problem or proposal.
- Steps to reproduce (for bugs).
- The Thunder version (output of `thunder --version`) and your OS/architecture.

## License

By contributing to Thunder, you agree that your contributions will be licensed under the project's MIT license.
