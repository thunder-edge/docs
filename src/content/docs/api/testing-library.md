---
title: "Testing Library"
description: "Assertions, test runner, mocking, and snapshot testing provided by the thunder:testing module."
---

The `thunder:testing` module is a zero-dependency testing library for edge functions. It provides assertions, a test runner with suites and hooks, mocking utilities, and snapshot testing.

## Import

```ts
import {
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
  assertSpyCalls,
  assertSpyCall,
  test,
  testIgnore,
  testOnly,
  testIf,
  testEach,
  suite,
  suiteIgnore,
  suiteOnly,
  runSuite,
  runSuites,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  mockFn,
  spyOn,
  mockFetch,
  mockFetchHandler,
  mockTime,
  getTestRunnerStats,
} from "thunder:testing";
```

The `thunder:testing` alias is resolved by Thunder CLI flows (`thunder watch`, `thunder bundle`, `thunder test`, `thunder check`).

---

## Assertions

### Basic Assertions

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
assertEquals(1 + 1, 2);
assertEquals([1, 2], [1, 2]);         // deep equality
assertEquals({ a: 1 }, { a: 1 });     // deep equality on objects
assertStrictEquals(NaN, NaN);          // true (uses Object.is)
assertExists("hello");
assertInstanceOf(new Error(), Error);
```

`assertEquals` supports deep comparison of: primitives, arrays, typed arrays, plain objects, `Date`, `RegExp`, `Set`, and `Map`. On failure it produces a line-by-line diff.

### Pattern and Collection Assertions

| Function | Description |
|----------|-------------|
| `assertMatch(text, regex, message?)` | Fails if `regex.test(text)` is `false` |
| `assertArrayIncludes(array, values, message?)` | Fails if any value is missing from array (deep equality) |
| `assertObjectMatch(actual, expected, message?)` | Subset assertion -- extra keys in `actual` are ignored |

```ts
assertMatch("hello world", /world/);
assertArrayIncludes([1, 2, 3, 4], [2, 4]);
assertObjectMatch(
  { id: 1, name: "Alice", role: "admin" },
  { name: "Alice" },
);
```

### Exception Assertions

| Function | Description |
|----------|-------------|
| `assertThrows(fn, ErrorClass?, message?)` | Fails if `fn` does not throw. Returns the caught `Error` |
| `assertRejects(fn, ErrorClass?, message?)` | Async version. Fails if the promise resolves. Returns the rejection `Error` |

```ts
const err = assertThrows(() => {
  throw new Error("boom");
});

assertThrows(() => {
  throw new TypeError("bad type");
}, TypeError);

const asyncErr = await assertRejects(async () => {
  throw new RangeError("out of range");
}, RangeError);
```

### AssertionError

All assertions throw `AssertionError` on failure.

```ts
import { AssertionError } from "thunder:testing";

try {
  assertEquals(1, 2);
} catch (err) {
  console.log(err instanceof AssertionError); // true
  console.log(err.message);                   // includes diff
}
```

---

## Test Runner

### Creating Tests

| Function | Description |
|----------|-------------|
| `test(name, fn, options?)` | Create a test case |
| `testIgnore(name, fn, options?)` | Create a skipped test |
| `testOnly(name, fn, options?)` | Create a focused test (only focused tests run) |
| `testIf(condition)` | Returns a test factory that skips when `condition` is `false` |
| `testEach(rows)` | Returns a factory for parameterized tests |

### Test Options

```ts
type TestOptions = {
  ignore?: boolean;     // Skip the test
  only?: boolean;       // Run only this test in the suite
  timeout?: number;     // Timeout in milliseconds
  concurrent?: boolean; // Allow parallel execution
  retry?: number;       // Retry count on failure
};
```

### Creating Suites

| Function | Description |
|----------|-------------|
| `suite(name, entries)` | Create a test suite |
| `suiteIgnore(name, entries)` | Create a skipped suite |
| `suiteOnly(name, entries)` | Create a focused suite |

### Running Suites

| Function | Description |
|----------|-------------|
| `runSuite(name, entries, options?)` | Run a single suite |
| `runSuites(suites)` | Run multiple suites in sequence |

```ts
await runSuite("math", [
  test("addition", () => {
    assertEquals(1 + 1, 2);
  }),
  test("multiplication", () => {
    assertEquals(3 * 4, 12);
  }),
]);
```

Output:

```
suite: math
addition... OK
multiplication... OK
suite done: 2/2 (ignored: 0, failed: 0)
```

Running multiple suites:

```ts
await runSuites([
  suite("unit", [
    test("basic", () => assertEquals(1, 1)),
  ]),
  suite("integration", [
    test("api call", async () => {
      const res = await fetch("https://api.example.com/health");
      assert(res.ok);
    }),
  ]),
]);
```

When any test has `only: true`, only focused tests run within that suite. When any suite has `only: true`, only focused suites run in `runSuites`.

---

## Lifecycle Hooks

Hooks are declared inline in the suite entry array.

| Hook | When it runs |
|------|-------------|
| `beforeAll(fn)` | Once before all tests in the suite |
| `afterAll(fn)` | Once after all tests in the suite |
| `beforeEach(fn)` | Before each individual test |
| `afterEach(fn)` | After each individual test |

```ts
let db: Database;

await runSuite("users", [
  beforeAll(async () => {
    db = await connectToTestDatabase();
  }),

  beforeEach(() => {
    // reset state before each test
  }),

  test("create user", async () => {
    const user = await db.createUser({ name: "Alice" });
    assert(user.id > 0);
  }),

  test("delete user", async () => {
    await db.deleteUser(1);
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

Hooks support both synchronous and asynchronous functions. If `beforeAll` fails, the entire suite is marked as failed.

---

## Conditional Tests

Use `testIf(condition)` to skip tests based on a runtime condition.

```ts
const isLinux = Deno.build.os === "linux";

await runSuite("platform", [
  testIf(isLinux)("linux-only test", () => {
    assert(true);
  }),
]);
```

---

## Parameterized Tests

Use `testEach(rows)` to generate a test for each row of data.

```ts
await runSuite("arithmetic", [
  ...testEach([
    [1, 2, 3],
    [4, 5, 9],
    [10, 20, 30],
  ] as const)("addition", (a, b, expected) => {
    assertEquals(a + b, expected);
  }),
]);
```

Each row generates a test named like `addition [0] [1,2,3]`.

---

## Timeout and Retry

```ts
await runSuite("resilience", [
  // Fails if it takes longer than 5 seconds
  test("with timeout", async () => {
    const res = await fetch("https://api.example.com/health");
    assert(res.ok);
  }, { timeout: 5000 }),

  // Retries up to 3 times before final failure
  test("flaky test", async () => {
    const res = await fetch("https://api.example.com/data");
    assert(res.ok);
  }, { retry: 3 }),
]);
```

---

## Concurrent Tests

Tests marked with `{ concurrent: true }` run in parallel via `Promise.all`. Sequential tests run first in declaration order, then concurrent tests run together.

```ts
await runSuite("parallel", [
  test("sequential first", () => {
    assert(true);
  }),

  test("request A", async () => {
    await new Promise((r) => setTimeout(r, 100));
    assert(true);
  }, { concurrent: true }),

  test("request B", async () => {
    await new Promise((r) => setTimeout(r, 100));
    assert(true);
  }, { concurrent: true }),
]);
```

---

## Mocking

### `mockFn(impl?)`

Create a mock function with call tracking.

```ts
const add = mockFn((a: number, b: number) => a + b);
const result = add(1, 2);

assertEquals(result, 3);
assertEquals(add.calls.length, 1);
assertEquals(add.calls[0].args, [1, 2]);
assertEquals(add.calls[0].result, 3);
```

Mock without implementation (returns `undefined`):

```ts
const noop = mockFn();
noop("hello");
assertEquals(noop.calls[0].args, ["hello"]);
```

#### Mock Properties

| Property/Method | Description |
|-----------------|-------------|
| `calls` | Array of `{ args, result?, error? }` call records |
| `mockClear()` | Clear the call history |
| `mockImplementation(fn)` | Replace the implementation |

```ts
const fn = mockFn(() => "original");
assertEquals(fn(), "original");

fn.mockImplementation(() => "replaced");
assertEquals(fn(), "replaced");

fn.mockClear();
assertEquals(fn.calls.length, 0);
```

Async mock functions automatically track resolved values and rejected errors:

```ts
const fetchUser = mockFn(async (id: number) => ({ id, name: "User " + id }));
const user = await fetchUser(42);
assertEquals(fetchUser.calls[0].result, { id: 42, name: "User 42" });
```

### `spyOn(target, method)`

Spy on an existing method. The original implementation is called, but calls are tracked.

```ts
const spy = spyOn(console, "log");

console.log("hello", "world");

assertEquals(spy.calls.length, 1);
assertEquals(spy.calls[0].args, ["hello", "world"]);

// Always restore when done
spy.restore();
```

The spy has all `Mock` properties plus `restore()` to reinstate the original method.

### Spy/Mock Assertions

| Function | Description |
|----------|-------------|
| `assertSpyCalls(spy, count, message?)` | Verify total call count |
| `assertSpyCall(spy, index, expected?)` | Verify a specific call by index |

```ts
const fn = mockFn((a: number, b: number) => a + b);
fn(1, 2);
fn(3, 4);

assertSpyCalls(fn, 2);
assertSpyCall(fn, 0, { args: [1, 2], result: 3 });
assertSpyCall(fn, 1, { args: [3, 4], result: 7 });
```

The `expected` object in `assertSpyCall` is partial. Verify only `args`, only `result`, only `error`, or any combination.

---

## Fetch Mocking

### `mockFetch(routes)`

Replace `globalThis.fetch` with a route map. Unmapped URLs return `404`.

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

  const notFound = await fetch("https://unknown.url");
  assertEquals(notFound.status, 404);
} finally {
  mock.restore();
}
```

Route response options:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | `number` | `200` | HTTP status code |
| `body` | `unknown` | none | String, Blob, FormData, or auto-serialized as JSON |
| `headers` | `Record<string, string>` | none | Additional headers |

If `body` is not a `BodyInit` type (string, Blob, etc.), it is serialized via `JSON.stringify` and `content-type: application/json` is set automatically.

### `mockFetchHandler(handler)`

Replace `globalThis.fetch` with a custom handler function for more complex scenarios.

```ts
const mock = mockFetchHandler((request) => {
  const url = new URL(request.url);
  if (url.pathname === "/users" && request.method === "GET") {
    return new Response(JSON.stringify([{ id: 1 }]), {
      headers: { "content-type": "application/json" },
    });
  }
  if (url.pathname === "/users" && request.method === "POST") {
    return new Response(JSON.stringify({ id: 2 }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  }
  return null; // Returns 501 for unhandled requests
});

try {
  const res = await fetch("https://api.test/users");
  assertEquals(res.status, 200);
} finally {
  mock.restore();
}
```

Both `mockFetch` and `mockFetchHandler` return a controller with:

| Property/Method | Description |
|-----------------|-------------|
| `calls` | Array of call records (`args[0]` is the `Request`) |
| `restore()` | Restore the original `fetch` |

---

## Fake Timers

### `mockTime()`

Replace `setTimeout`, `clearTimeout`, `setInterval`, and `clearInterval` with a virtual clock.

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

### MockClock API

| Method | Description |
|--------|-------------|
| `now()` | Returns the current virtual time |
| `tick(ms)` | Advance time by `ms` and execute due timers |
| `restore()` | Restore original timer functions and clear pending timers |

Interval example:

```ts
const clock = mockTime();

try {
  const calls: number[] = [];
  const id = setInterval(() => calls.push(clock.now()), 100);

  clock.tick(350);
  assertEquals(calls.length, 3); // fired at 100, 200, 300

  clearInterval(id);
  clock.tick(200);
  assertEquals(calls.length, 3); // no more firings
} finally {
  clock.restore();
}
```

Using with hooks:

```ts
import { type MockClock } from "thunder:testing";

let clock: MockClock;

await runSuite("timers", [
  beforeEach(() => { clock = mockTime(); }),
  afterEach(() => { clock.restore(); }),

  test("debounce waits correctly", () => {
    let fired = false;
    setTimeout(() => { fired = true; }, 300);
    clock.tick(299);
    assert(!fired);
    clock.tick(1);
    assert(fired);
  }),
]);
```

---

## Snapshot Testing

### `assertSnapshot(value, options?)`

Compare a value against a saved snapshot file. On the first run the snapshot is created. On subsequent runs the value is compared and a diff is shown on mismatch.

```ts
const user = { id: 1, name: "Alice", role: "admin" };
assertSnapshot(user);
```

Snapshots are stored in `__snapshots__/<test-filename>.snap` relative to the test file. Format is JSON. The snapshot key is the current test name.

### Snapshot Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | current test name | Custom snapshot key |
| `filePath` | `string` | auto-detected | Test file path |
| `update` | `boolean` | `false` | Overwrite snapshot instead of comparing |

```ts
await runSuite("snapshots", [
  test("user schema", () => {
    assertSnapshot({ id: 1, name: "Alice" });
  }),

  test("custom key", () => {
    assertSnapshot({ foo: "bar" }, { name: "my-custom-snapshot" });
  }),

  test("force update", () => {
    assertSnapshot({ updated: true }, { update: true });
  }),
]);
```

---

## Runner Statistics

After running suites, query accumulated statistics:

```ts
const stats = getTestRunnerStats();
console.log(stats);
// {
//   suitesTotal: 3,
//   suitesPassed: 2,
//   suitesFailed: 1,
//   suitesIgnored: 0,
//   testsTotal: 10,
//   testsPassed: 8,
//   testsFailed: 1,
//   testsIgnored: 1,
// }
```

---

## Complete Example

```ts
import {
  runSuite,
  test,
  testIgnore,
  beforeAll,
  afterAll,
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
} from "thunder:testing";

let clock;

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
      console.warn("attention");
      assertSpyCalls(spy, 1);
      assertSpyCall(spy, 0, { args: ["attention"] });
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
    // does not run
  }),
]);
```

---

## Running Tests

```bash
thunder test --path "./tests/js/**/*.ts" --ignore "./tests/js/lib/**"
```
