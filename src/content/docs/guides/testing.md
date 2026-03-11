---
title: "Testing Functions"
description: "Write and run tests for Thunder edge functions using the built-in thunder:testing library."
---

Thunder includes a built-in testing library with assertions, mocking, lifecycle hooks, snapshot testing, and a test runner. Tests execute inside the same V8 isolate environment as your functions, so you test against the real runtime behavior.

## Quick start

Create a test file `math.test.ts`:

```ts
import { runSuite, test, assertEquals } from "thunder:testing";

await runSuite("math", [
  test("addition works", () => {
    assertEquals(1 + 1, 2);
  }),

  test("multiplication works", () => {
    assertEquals(3 * 4, 12);
  }),
]);
```

Run it:

```bash
thunder test --path "./math.test.ts"
```

Output:

```
suite: math
addition works... OK
multiplication works... OK
suite done: 2/2 (ignored: 0, failed: 0)
```

## Importing thunder:testing

All test APIs come from a single module:

```ts
import {
  // Runner
  runSuite,
  runSuites,
  suite,
  suiteOnly,
  suiteIgnore,

  // Test creation
  test,
  testOnly,
  testIgnore,
  testIf,
  testEach,

  // Assertions
  assert,
  assertEquals,
  assertNotEquals,
  assertStrictEquals,
  assertExists,
  assertInstanceOf,
  assertMatch,
  assertArrayIncludes,
  assertObjectMatch,
  assertThrows,
  assertRejects,
  assertSnapshot,

  // Mocking
  mockFn,
  spyOn,
  mockFetch,
  mockFetchHandler,
  mockTime,

  // Spy assertions
  assertSpyCalls,
  assertSpyCall,

  // Lifecycle hooks
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "thunder:testing";
```

The `thunder:testing` alias is resolved by Thunder CLI flows (`thunder watch`, `thunder bundle`, `thunder test`, `thunder check`).

## Assertions

### Basic assertions

| Function | Description |
|----------|-------------|
| `assert(condition, message?)` | Fails if `condition` is falsy |
| `assertEquals(actual, expected, message?)` | Deep equality comparison |
| `assertNotEquals(actual, expected, message?)` | Fails if values are deeply equal |
| `assertStrictEquals(actual, expected, message?)` | Strict equality via `Object.is()` |
| `assertExists(value, message?)` | Fails if `null` or `undefined` |
| `assertInstanceOf(value, Type, message?)` | Checks `instanceof` |

```ts
assert(true);
assertEquals([1, 2], [1, 2]);           // deep equality on arrays
assertEquals({ a: 1 }, { a: 1 });       // deep equality on objects
assertStrictEquals(NaN, NaN);            // true (uses Object.is)
assertExists("hello");
assertInstanceOf(new Error(), Error);
```

`assertEquals` supports deep comparison of primitives, arrays, typed arrays, plain objects, `Date`, `RegExp`, `Set`, and `Map`. On failure it produces a readable diff.

### Pattern and collection assertions

```ts
assertMatch("hello world", /world/);
assertArrayIncludes([1, 2, 3, 4], [2, 4]);
assertObjectMatch(
  { id: 1, name: "Alice", role: "admin" },
  { name: "Alice" },  // subset match -- does not require all keys
);
```

### Exception assertions

```ts
// Synchronous: verify that a function throws
const err = assertThrows(() => {
  throw new Error("boom");
});

// Verify specific error type
assertThrows(() => {
  throw new TypeError("bad type");
}, TypeError);

// Async: verify that a promise rejects
const rejectedErr = await assertRejects(async () => {
  throw new Error("async boom");
});

// Verify specific rejection type
await assertRejects(async () => {
  throw new RangeError("out of range");
}, RangeError);
```

Both `assertThrows` and `assertRejects` return the captured `Error` for further inspection.

## Writing test suites

Use `test()` to create test cases and `runSuite()` to execute them:

```ts
await runSuite("my feature", [
  test("scenario A", () => {
    assertEquals(2 + 2, 4);
  }),

  test("scenario B", async () => {
    const res = await fetch("https://httpbin.org/get");
    assert(res.ok);
  }),
]);
```

### Test options

Each test accepts an optional third argument:

```ts
type TestOptions = {
  ignore?: boolean;     // Skip this test
  only?: boolean;       // Run only this test in the suite
  timeout?: number;     // Timeout in milliseconds
  concurrent?: boolean; // Allow parallel execution
  retry?: number;       // Number of retries on failure
};
```

Example:

```ts
test("slow operation", async () => {
  const res = await fetch("https://api.example.com/health");
  assert(res.ok);
}, { timeout: 5000 });

test("flaky test", async () => {
  // retries up to 3 times before marking as failed
  const res = await fetch("https://api.example.com/data");
  assert(res.ok);
}, { retry: 3 });
```

### Skipping and focusing

```ts
// Skip a test
testIgnore("not ready yet", () => { /* ... */ });

// Run only this test (others in the suite are skipped)
testOnly("focused test", () => { /* ... */ });
```

### Running multiple suites

```ts
await runSuites([
  suite("math", [
    test("add", () => assertEquals(1 + 2, 3)),
  ]),
  suite("strings", [
    test("concat", () => assertEquals("a" + "b", "ab")),
  ]),
]);
```

Use `suiteOnly` to focus a suite and `suiteIgnore` to skip one.

## Lifecycle hooks

Hooks run at specific points in the suite lifecycle. Declare them inline in the test list:

```ts
let db: any;

await runSuite("database", [
  beforeAll(async () => {
    db = await connectToTestDatabase();
  }),

  beforeEach(() => {
    // reset state before each test
  }),

  test("create record", async () => {
    const record = await db.create({ name: "test" });
    assert(record.id > 0);
  }),

  test("delete record", async () => {
    await db.delete(1);
    assert(true);
  }),

  afterEach(() => {
    // cleanup after each test
  }),

  afterAll(async () => {
    await db.close();
  }),
]);
```

| Hook | When it runs |
|------|-------------|
| `beforeAll(fn)` | Once before all tests in the suite |
| `afterAll(fn)` | Once after all tests in the suite |
| `beforeEach(fn)` | Before each individual test |
| `afterEach(fn)` | After each individual test |

Hooks support both synchronous and asynchronous functions. If `beforeAll` fails, the entire suite is marked as failed.

## Mocking

### Mock functions

Create a tracked function with `mockFn()`:

```ts
const add = mockFn((a: number, b: number) => a + b);
const result = add(1, 2);

assertEquals(result, 3);
assertEquals(add.calls.length, 1);
assertEquals(add.calls[0].args, [1, 2]);
assertEquals(add.calls[0].result, 3);
```

Mock without an implementation (returns `undefined`):

```ts
const noop = mockFn();
noop("hello");
assertEquals(noop.calls[0].args, ["hello"]);
```

Change the implementation at runtime:

```ts
const fn = mockFn(() => "original");
assertEquals(fn(), "original");

fn.mockImplementation(() => "replaced");
assertEquals(fn(), "replaced");
```

Clear call history:

```ts
fn.mockClear();
assertEquals(fn.calls.length, 0);
```

### Spying on methods

`spyOn` wraps an existing method while preserving its original behavior:

```ts
const spy = spyOn(console, "log");

console.log("hello", "world");

assertEquals(spy.calls.length, 1);
assertEquals(spy.calls[0].args, ["hello", "world"]);

// Always restore after use
spy.restore();
```

### Spy assertions

```ts
const fn = mockFn((a: number, b: number) => a + b);
fn(1, 2);
fn(3, 4);

assertSpyCalls(fn, 2);
assertSpyCall(fn, 0, { args: [1, 2], result: 3 });
assertSpyCall(fn, 1, { args: [3, 4], result: 7 });
```

### Mocking fetch

**Route map approach** -- map URLs to static responses:

```ts
const mock = mockFetch({
  "https://api.example.com/users": {
    status: 200,
    body: [{ id: 1, name: "Alice" }],
    headers: { "x-total": "1" },
  },
  "https://api.example.com/health": {
    status: 204,
  },
});

try {
  const res = await fetch("https://api.example.com/users");
  assertEquals(res.status, 200);
  assertEquals(await res.json(), [{ id: 1, name: "Alice" }]);

  // Unmapped URLs return 404
  const notFound = await fetch("https://api.example.com/other");
  assertEquals(notFound.status, 404);
} finally {
  mock.restore();
}
```

**Handler approach** -- use a function for dynamic responses:

```ts
const mock = mockFetchHandler((request) => {
  const url = new URL(request.url);

  if (url.pathname === "/users" && request.method === "GET") {
    return new Response(JSON.stringify([{ id: 1 }]), {
      headers: { "content-type": "application/json" },
    });
  }

  return null; // returns 501 for unhandled routes
});

try {
  const res = await fetch("https://api.test/users");
  assertEquals(res.status, 200);
} finally {
  mock.restore();
}
```

### Mocking timers

`mockTime()` replaces `setTimeout`, `clearTimeout`, `setInterval`, and `clearInterval` with controlled versions:

```ts
const clock = mockTime();

try {
  let called = false;
  setTimeout(() => { called = true; }, 1000);

  assert(!called);
  clock.tick(999);
  assert(!called);
  clock.tick(1);
  assert(called);
} finally {
  clock.restore();
}
```

The `MockClock` API:

| Method | Description |
|--------|-------------|
| `clock.now()` | Returns the current mock time |
| `clock.tick(ms)` | Advances time and fires due timers |
| `clock.restore()` | Restores original timer functions |

## Snapshot testing

`assertSnapshot` saves a serialized value to a `.snap` file and compares against it on subsequent runs:

```ts
await runSuite("snapshots", [
  test("user schema", () => {
    const data = { id: 1, name: "Alice", role: "admin" };
    assertSnapshot(data);
  }),

  test("custom snapshot name", () => {
    assertSnapshot({ foo: "bar" }, { name: "my-custom-snapshot" });
  }),
]);
```

Snapshots are stored in `__snapshots__/` relative to the test file. On first run, the snapshot is created. On subsequent runs, mismatches produce a diff. Pass `{ update: true }` to overwrite an existing snapshot.

## Parametrized tests

`testEach` generates a test case for each row of input data:

```ts
await runSuite("addition", [
  ...testEach([
    [1, 2, 3],
    [4, 5, 9],
    [10, 20, 30],
  ] as const)("adds correctly", (a, b, expected) => {
    assertEquals(a + b, expected);
  }),
]);
```

Each row produces a test named like `adds correctly [0] [1,2,3]`.

## Conditional tests

`testIf` runs a test only when a condition is true:

```ts
const featureEnabled = typeof Deno === "object";

await runSuite("feature-gated", [
  testIf(featureEnabled)("only runs when condition is true", () => {
    assert(true);
  }),
]);
```

When the condition is false, the test is skipped.

## Running tests

### Run all tests matching a glob

```bash
thunder test --path "./tests/js/**/*.ts"
```

### Exclude files

```bash
thunder test --path "./tests/js/**/*.ts" --ignore "./tests/js/lib/**"
```

### Run a single test file

```bash
thunder test --path ./tests/js/my-feature.test.ts
```

### Supported file extensions

`.ts`, `.js`, `.mts`, `.mjs`

## Complete example

```ts
import {
  runSuite,
  test,
  testIgnore,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  assert,
  assertEquals,
  assertThrows,
  assertSpyCalls,
  assertSpyCall,
  mockFn,
  spyOn,
  mockFetch,
  mockTime,
  assertSnapshot,
  type MockClock,
} from "thunder:testing";

let clock: MockClock;

await runSuite("complete example", [
  beforeAll(() => {
    clock = mockTime();
  }),

  afterAll(() => {
    clock.restore();
  }),

  test("basic assertions", () => {
    assert(true);
    assertEquals([1, 2, 3], [1, 2, 3]);
    assertThrows(() => { throw new Error("boom"); });
  }),

  test("mock function", () => {
    const fn = mockFn((x: number) => x * 2);
    fn(5);
    fn(10);

    assertSpyCalls(fn, 2);
    assertSpyCall(fn, 0, { args: [5], result: 10 });
    assertSpyCall(fn, 1, { args: [10], result: 20 });
  }),

  test("spy on method", () => {
    const spy = spyOn(console, "warn");
    try {
      console.warn("attention!");
      assertSpyCalls(spy, 1);
      assertSpyCall(spy, 0, { args: ["attention!"] });
    } finally {
      spy.restore();
    }
  }),

  test("mock fetch", async () => {
    const mock = mockFetch({
      "https://api.test/data": {
        status: 200,
        body: { items: [1, 2, 3] },
      },
    });

    try {
      const res = await fetch("https://api.test/data");
      assertEquals(await res.json(), { items: [1, 2, 3] });
    } finally {
      mock.restore();
    }
  }),

  test("fake timers", () => {
    let count = 0;
    setInterval(() => { count++; }, 100);

    clock.tick(350);
    assertEquals(count, 3);
  }),

  test("snapshot", () => {
    assertSnapshot({ version: 1, data: "test" });
  }),

  testIgnore("disabled test", () => {
    // does not execute
  }),
]);
```
