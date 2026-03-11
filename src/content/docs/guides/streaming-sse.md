---
title: "Streaming & SSE"
description: "Stream chunked responses and Server-Sent Events from Thunder edge functions."
---

Thunder supports streaming responses using the standard Web `ReadableStream` API. This enables chunked transfer encoding, Server-Sent Events (SSE), and newline-delimited JSON (NDJSON) patterns directly from edge functions.

## Chunked streaming with ReadableStream

Return a `ReadableStream` as the response body to stream data in chunks:

```ts
export default function handler(req: Request): Response {
  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 1; i <= 10; i++) {
        const chunk = JSON.stringify({ number: i, timestamp: new Date().toISOString() }) + "\n";
        controller.enqueue(chunk);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson",
      "transfer-encoding": "chunked",
    },
  });
}
```

Each call to `controller.enqueue()` sends a chunk to the client immediately. Call `controller.close()` when the stream is complete.

Test with curl:

```bash
curl -N http://localhost:8080/my-function
```

The `-N` flag disables curl's output buffering, so you see each chunk as it arrives.

## Server-Sent Events (SSE)

SSE is a one-directional protocol for pushing real-time updates from server to client over a standard HTTP connection. The response uses `content-type: text/event-stream` and a specific text format.

### SSE format

Each event consists of one or more fields followed by a blank line:

```
event: update
data: {"counter": 1, "timestamp": "2026-01-15T10:00:00Z"}

event: update
data: {"counter": 2, "timestamp": "2026-01-15T10:00:01Z"}

```

### SSE example with ReadableStream

```ts
export default function handler(req: Request): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: Record<string, unknown>, eventType = "message") => {
        const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(message);
      };

      sendEvent({ status: "connected" }, "connect");

      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        sendEvent({ counter: i + 1, timestamp: new Date().toISOString() }, "update");
      }

      sendEvent({ status: "completed", totalEvents: 10 }, "done");
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "connection": "keep-alive",
    },
  });
}
```

Test SSE with curl:

```bash
curl -N http://localhost:8080/my-sse-function
```

## StreamResponse helper

The `thunder:http` module provides a `StreamResponse` builder with convenience methods for SSE and NDJSON content types.

### SSE with StreamResponse

```ts
import { StreamResponse } from "thunder:http";

export default function handler(_req: Request): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      for (let i = 0; i < 5; i++) {
        const event = `event: tick\ndata: ${JSON.stringify({ i })}\n\n`;
        controller.enqueue(encoder.encode(event));
        await new Promise((r) => setTimeout(r, 1000));
      }
      controller.close();
    },
  });

  return StreamResponse(stream)
    .sse()
    .toResponse();
}
```

The `.sse()` method sets the appropriate headers:
- `content-type: text/event-stream`
- `cache-control: no-cache`
- `connection: keep-alive`

### NDJSON with StreamResponse

```ts
import { StreamResponse } from "thunder:http";

export default function handler(_req: Request): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      for (let i = 0; i < 100; i++) {
        const line = JSON.stringify({ number: i, squared: i * i }) + "\n";
        controller.enqueue(encoder.encode(line));
        await new Promise((r) => setTimeout(r, 10));
      }
      controller.close();
    },
  });

  return StreamResponse(stream)
    .ndjson()
    .toResponse();
}
```

The `.ndjson()` method sets `content-type: application/x-ndjson`.

## Generator-based streaming

You can use generator functions to produce data lazily and stream the results:

```ts
export default function handler(req: Request): Response {
  function* fibonacci(max: number): Generator<number> {
    let a = 0, b = 1;
    while (a <= max) {
      yield a;
      [a, b] = [b, a + b];
    }
  }

  const stream = new ReadableStream({
    start(controller) {
      for (const value of fibonacci(1000)) {
        controller.enqueue(JSON.stringify({ value }) + "\n");
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson" },
  });
}
```

For async generators that need delays between chunks:

```ts
export default function handler(req: Request): Response {
  async function* generateEvents(count: number) {
    for (let i = 0; i < count; i++) {
      await new Promise((r) => setTimeout(r, 500));
      yield { event: i, timestamp: new Date().toISOString() };
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      for await (const event of generateEvents(20)) {
        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    },
  });
}
```

## Wall clock timeout for long streams

By default, Thunder enforces a per-request wall clock timeout of 60 seconds (`--wall-clock-timeout-ms`, default `60000`). Streaming responses that run longer than this limit are terminated.

For long-lived streams (such as SSE connections that remain open for minutes), increase the timeout when starting the runtime:

```bash
thunder start --wall-clock-timeout-ms 300000
```

This sets the timeout to 5 minutes. Use `0` for unlimited (not recommended in production).

The environment variable equivalent is:

```bash
export EDGE_RUNTIME_WALL_CLOCK_TIMEOUT_MS=300000
thunder start
```

In watch mode, the same flag applies:

```bash
thunder watch --path ./examples --wall-clock-timeout-ms 300000
```

## Error handling in streams

If an error occurs during streaming, close the stream with `controller.error()`:

```ts
const stream = new ReadableStream({
  async start(controller) {
    try {
      for (let i = 0; i < 100; i++) {
        const data = await fetchExternalData(i);
        controller.enqueue(JSON.stringify(data) + "\n");
      }
      controller.close();
    } catch (err) {
      // Send an error event before closing (SSE pattern)
      const errorEvent = `event: error\ndata: ${JSON.stringify({ error: (err as Error).message })}\n\n`;
      controller.enqueue(errorEvent);
      controller.close();
    }
  },
});
```

## Client-side consumption

### Browser EventSource (SSE)

```js
const source = new EventSource("https://my-edge.example.com/sse-function");

source.addEventListener("update", (event) => {
  const data = JSON.parse(event.data);
  console.log("Update:", data);
});

source.addEventListener("error", () => {
  console.log("Connection lost, reconnecting...");
});
```

### Browser fetch with ReadableStream (NDJSON)

```js
const response = await fetch("https://my-edge.example.com/stream-function");
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const text = decoder.decode(value, { stream: true });
  for (const line of text.split("\n").filter(Boolean)) {
    console.log(JSON.parse(line));
  }
}
```
