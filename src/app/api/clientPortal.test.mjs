import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import { transformSync } from "esbuild";

const require = createRequire(import.meta.url);
function adapter() {
  const source = readFileSync(new URL("./clientPortal.ts", import.meta.url), "utf8");
  const compiled = transformSync(source, { loader: "ts", format: "cjs" });
  const module = new Module(new URL("./clientPortal.fixture.cjs", import.meta.url).pathname);
  module.paths = require.resolve.paths("react");
  module.require = request => request === "./client" ? {
    api: (path, options) => ({ path, options }),
    queryString: values => new URLSearchParams(Object.entries(values).map(([key, value]) => [key, String(value)])).toString(),
  } : require(request);
  module._compile(compiled.code, "clientPortal.fixture.cjs");
  return module.exports.clientPortalApi;
}

test("client portal adapter uses the completed client endpoints and preserves string IDs", () => {
  const clientPortalApi = adapter();
  const result = clientPortalApi.order("9007199254740993");
  assert.equal(result.path, "/api/client/orders/9007199254740993");
  const read = clientPortalApi.markNotificationRead("9007199254740994");
  assert.equal(read.path, "/api/client/notifications/9007199254740994/read");
  assert.equal(read.options.method, "PATCH");
});

test("client portal adapter encodes query parameters without accepting ownership parameters", () => {
  const result = adapter().orders({ page: 2, pageSize: 10, q: "A&B" });
  assert.equal(result.path, "/api/client/orders?page=2&pageSize=10&q=A%26B");
});
