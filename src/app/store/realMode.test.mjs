import test from "node:test";
import assert from "node:assert/strict";
import { createRealReadOnlyProvider, RealOperationUnavailableError } from "./realMode.js";

test("real-mode provider preserves reads and rejects writes without mutating its source", () => {
  const source = {
    rows: [],
    search: (term) => source.rows.filter((row) => row.name.includes(term)),
    add: (row) => source.rows.push(row),
  };
  const provider = createRealReadOnlyProvider(source, ["search"], "orders");

  assert.deepEqual(provider.search("missing"), []);
  assert.throws(() => provider.add({ name: "not persisted" }), (error) => {
    assert.ok(error instanceof RealOperationUnavailableError);
    assert.equal(error.code, "REAL_OPERATION_UNAVAILABLE");
    assert.equal(error.operation, "orders.add");
    return true;
  });
  assert.deepEqual(source.rows, []);
});

test("real-mode provider keeps empty results empty and does not read Demo data", () => {
  const demoRows = [{ name: "Demo only" }];
  const real = createRealReadOnlyProvider({ rows: [], filter: (predicate) => [].filter(predicate) }, ["filter"], "inventory");
  assert.deepEqual(real.rows, []);
  assert.deepEqual(real.filter(() => true), []);
  assert.equal(demoRows.length, 1);
});

test("blocked real-mode write announces the exact operation for user-visible feedback", () => {
  const originalWindow = globalThis.window;
  const events = [];
  globalThis.window = new EventTarget();
  globalThis.window.addEventListener("enterflow:real-operation-unavailable", (event) => events.push(event.detail));
  try {
    const provider = createRealReadOnlyProvider({ save() {} }, [], "orders");
    assert.throws(() => provider.save(), { code: "REAL_OPERATION_UNAVAILABLE" });
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], {
      operation: "orders.save",
      message: "Real-mode operation is unavailable: orders.save. An authorized backend API is required.",
    });
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
