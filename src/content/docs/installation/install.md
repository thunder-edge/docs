---
title: "Install Thunder"
---

The fastest way to get Thunder running is to download a prebuilt binary from GitHub Releases. If you prefer to compile it yourself, see [Build from Source](/docs/installation/build-from-source/).

## Install from GitHub Releases

Run the installer script:

```bash
curl -fsSL https://raw.githubusercontent.com/thunder-edge/runtime/main/install.sh | bash
```

By default this fetches the latest **stable** release for your platform, places the `thunder` binary in a user-local directory (`~/.local/bin` on Linux, `~/bin` or `~/.local/bin` on macOS), and adds it to your `PATH`.

### Channel options

Select a release channel with `--channel`:

```bash
# Latest stable release (default)
curl -fsSL https://raw.githubusercontent.com/thunder-edge/runtime/main/install.sh | bash -s -- --channel stable

# Latest unstable (nightly) release
curl -fsSL https://raw.githubusercontent.com/thunder-edge/runtime/main/install.sh | bash -s -- --channel unstable
```

### Install a specific version

Pin a release tag or build from a specific commit:

```bash
# By tag
curl -fsSL https://raw.githubusercontent.com/thunder-edge/runtime/main/install.sh | bash -s -- --tag v1.0.0

# By commit (requires Rust toolchain -- builds from source)
curl -fsSL https://raw.githubusercontent.com/thunder-edge/runtime/main/install.sh | bash -s -- --commit abc123
```

### Custom install directory

Override the default install location with `--install-dir`:

```bash
curl -fsSL https://raw.githubusercontent.com/thunder-edge/runtime/main/install.sh | bash -s -- --install-dir /usr/local/bin
```

## Build from source

If you need to build from a local checkout or want to hack on Thunder itself, follow the [Build from Source](/docs/installation/build-from-source/) guide.

## Verify the installation

After installing, confirm that the binary is available:

```bash
thunder --help
```

You should see the Thunder CLI help output with available commands and options.
