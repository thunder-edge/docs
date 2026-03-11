---
title: "Debugging"
description: "Debug Thunder edge functions with VS Code, Chrome DevTools, or Neovim using the V8 Inspector Protocol."
---

Thunder exposes the V8 Inspector Protocol for debugging TypeScript and JavaScript edge functions with breakpoints, variable inspection, and step-through execution. Three clients are supported: VS Code, Chrome DevTools, and Neovim (via nvim-dap).

## Prerequisites

- The `thunder` binary (a debug build via `cargo build` is recommended for development).
- One of the supported debug clients:
  - **VS Code** -- JavaScript Debugger extension (built-in since VS Code 1.60).
  - **Chrome** -- any Chromium-based browser (Chrome, Edge, Brave).
  - **Neovim** -- `nvim-dap` + `nvim-dap-vscode-js` (or direct adapter).

All three clients use the Chrome DevTools Protocol (CDP) over WebSocket. The same runtime flags and ports work identically across them.

## Debugging modes

### watch --inspect (attach and continue)

Starts the inspector server and continues running immediately. Breakpoints set in your source files are hit when matching requests arrive.

```bash
thunder watch --path ./examples/hello/hello.ts --inspect
```

The inspector defaults to port `9229`. To use a different port:

```bash
thunder watch --path ./examples/hello/hello.ts --inspect 9230
```

### watch --inspect-brk (break on first statement)

Pauses execution before the first line of user code runs. The process blocks until a debugger attaches. Use this to debug module initialization or the very first request.

```bash
thunder watch --path ./examples/hello/hello.ts --inspect --inspect-brk
```

Note: `--inspect` is required alongside `--inspect-brk`. The `--inspect-brk` flag sets the break-on-first-statement behavior; `--inspect` enables the server.

### test --inspect (debug a test file)

Attaches the inspector to a single test run. When `--inspect` is active, exactly one test file must be selected.

```bash
thunder test --path ./tests/js/my-test.ts --inspect
```

## VS Code setup

### Launch configurations

Add these to your `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Attach Thunder (9229)",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "continueOnAttach": true,
      "sourceMaps": true
    },
    {
      "name": "Attach Thunder (inspect-brk, 9229)",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "sourceMaps": true
    }
  ]
}
```

The first configuration is for `--inspect` mode (does not pause on attach). The second is for `--inspect-brk` mode (pauses at the first statement).

Key settings:

- `"type": "node"` -- required because the runtime advertises itself as a Node target in the `/json/list` endpoint.
- `"request": "attach"` -- connects to an already-running process.
- `"sourceMaps": true` -- enables automatic TypeScript source map resolution.
- `"continueOnAttach": true` -- prevents VS Code from pausing when it connects (use this for `--inspect`, omit for `--inspect-brk`).

### Step-by-step workflow

1. Start the runtime with the inspector enabled:

   ```bash
   thunder watch --path ./examples/hello/hello.ts --inspect
   ```

   You should see:

   ```
   Inspector server started on 127.0.0.1:9229 (target: hello)
   ```

2. In VS Code, open the **Run and Debug** panel (`Ctrl+Shift+D` / `Cmd+Shift+D`).

3. Select **"Attach Thunder (9229)"** and press F5.

4. Set a breakpoint in your TypeScript source file.

5. Trigger the function:

   ```bash
   curl http://localhost:9000/hello
   ```

6. VS Code stops at the breakpoint. Inspect variables, step through code, and use the debug console.

## Chrome DevTools setup

1. Start the runtime with `--inspect`:

   ```bash
   thunder watch --path ./examples/hello/hello.ts --inspect
   ```

2. Open a Chromium-based browser and navigate to:

   ```
   chrome://inspect
   ```

3. Under **"Discover network targets"**, click **Configure...** and add:

   ```
   127.0.0.1:9229
   ```

4. The function target (e.g., `hello`) appears under **"Remote Target"**. Click **inspect**.

5. A DevTools window opens. Go to the **Sources** tab to set breakpoints in your TypeScript files.

6. Trigger the function:

   ```bash
   curl http://localhost:9000/hello
   ```

For `--inspect-brk` mode, open Chrome DevTools before execution starts. Chrome pauses at the first statement immediately.

Limitations:

- Chrome DevTools does not persist breakpoints between sessions.
- The Console tab cannot call `fetch()` against localhost due to browser sandbox restrictions. Use curl instead.

## Neovim nvim-dap setup

### Dependencies

Install using lazy.nvim (or your plugin manager):

```lua
{
  "mfussenegger/nvim-dap",
  dependencies = {
    "microsoft/vscode-js-debug",
    "mxsdev/nvim-dap-vscode-js",
    "rcarriga/nvim-dap-ui",       -- optional
    "nvim-neotest/nvim-nio",      -- required by nvim-dap-ui
  },
}
```

Build the adapter once:

```bash
cd ~/.local/share/nvim/lazy/vscode-js-debug
npm install && npx gulp vsDebugServerBundle
mv dist out
```

### Configuration

Add to your Neovim config:

```lua
local dap = require("dap")
local dap_vscode_js = require("dap-vscode-js")

dap_vscode_js.setup({
  debugger_path = vim.fn.stdpath("data") .. "/lazy/vscode-js-debug",
  adapters = { "pwa-node" },
})

dap.configurations.typescript = {
  {
    type = "pwa-node",
    request = "attach",
    name = "Attach Thunder (9229)",
    port = 9229,
    address = "127.0.0.1",
    continueOnAttach = true,
    sourceMaps = true,
    resolveSourceMapLocations = { "${workspaceFolder}/**" },
  },
  {
    type = "pwa-node",
    request = "attach",
    name = "Attach Thunder (inspect-brk, 9229)",
    port = 9229,
    address = "127.0.0.1",
    sourceMaps = true,
    resolveSourceMapLocations = { "${workspaceFolder}/**" },
  },
}

dap.configurations.javascript = dap.configurations.typescript
```

### Workflow

1. Start the runtime: `thunder watch --path ./examples/hello/hello.ts --inspect`
2. Open the TypeScript file in Neovim.
3. Set a breakpoint: `:lua require("dap").toggle_breakpoint()`
4. Start the session: `:lua require("dap").continue()` and select "Attach Thunder (9229)".
5. Trigger the function: `curl http://localhost:9000/hello`
6. Use standard nvim-dap keymaps to step through code.

Suggested keymaps:

| Key | Action |
|-----|--------|
| `<F5>` | Continue |
| `<F10>` | Step over |
| `<F11>` | Step into |
| `<F12>` | Step out |
| `<leader>db` | Toggle breakpoint |
| `<leader>dr` | Open REPL |

### Minimal setup without vscode-js-debug

If you prefer not to install the full adapter, connect directly to the inspector:

```lua
local dap = require("dap")

dap.adapters.node2 = {
  type = "server",
  host = "127.0.0.1",
  port = 9229,
}

dap.configurations.typescript = {
  {
    type = "node2",
    request = "attach",
    name = "Attach Thunder direct (9229)",
    sourceMaps = true,
    continueOnAttach = true,
  },
}
```

This skips the adapter process entirely. Source map resolution is more limited compared to the full vscode-js-debug adapter, but basic breakpoints and variable inspection work.

## Source maps

Source maps work automatically. TypeScript files are compiled and bundled into `.eszip` archives during the watch build step. The compiler emits a source map for each module, stored alongside the compiled output inside the bundle.

When a module is loaded into V8, the runtime attaches the source map as an inline base64 data URL. V8 notifies the debugger via CDP, and the debug client resolves original TypeScript file paths from the `sources` array automatically.

No manual source map configuration is required.

## Using debugger statements

Add `debugger;` anywhere in your source to force a breakpoint without setting one in the IDE:

```ts
export default async function handler(req: Request): Promise<Response> {
  debugger; // pauses here when a debugger is attached
  const body = await req.json();
  return Response.json({ received: body });
}
```

With `--inspect`, `debugger;` statements are hit only after the client is attached. With `--inspect-brk`, the process waits for attachment first, so all `debugger;` statements are reachable.

## Debugging multiple functions

When multiple functions are loaded, each gets its own inspector port, assigned sequentially from the base port:

```bash
thunder watch --path ./examples --inspect 9229
# hello       -> port 9229
# json-api    -> port 9230
# cors        -> port 9231
# ...
```

Add a separate launch configuration for each function you want to debug:

```json
{
  "name": "Attach Thunder (json-api:9230)",
  "type": "node",
  "request": "attach",
  "port": 9230,
  "continueOnAttach": true,
  "sourceMaps": true
}
```

## Troubleshooting

### Cannot connect or connection refused

- Ensure the runtime is running before attaching.
- Verify the port matches between `--inspect` and your launch configuration.
- Check that nothing else is using the port: `lsof -i :9229`.

### Breakpoints not hit

- Ensure `sourceMaps: true` is set in the launch configuration.
- Confirm the breakpoint is in a file that is part of the loaded function.
- Trigger the function with an HTTP request. The runtime only executes handler code when a request arrives.

### Port already in use after a crash

The inspector TCP port is held until the process fully exits. If the port is stuck after a crash:

```bash
lsof -ti :9229 | xargs kill -9
```

### "Unknown Source" in the call stack

This happens when the debugger receives a pause event before processing the script-parsed event. Try `--inspect-brk` instead of `--inspect` to force an event loop flush before any code runs.

## Security note

The inspector binds to `127.0.0.1` by default and should only be used in development. The `--inspect-allow-remote` flag binds on `0.0.0.0`, exposing debugger endpoints to the network. Never enable the inspector in production.
