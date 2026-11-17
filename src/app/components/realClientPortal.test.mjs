import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./RealClientPortal.tsx", import.meta.url), "utf8");
const data = await readFile(new URL("./client/data.tsx", import.meta.url), "utf8");
const portal = await readFile(new URL("./client/ClientPortal.tsx", import.meta.url), "utf8");
const app = await readFile(new URL("../App.tsx", import.meta.url), "utf8");

test("authenticated Client routing selects the scoped original portal without changing employee routing", () => {
  assert.match(app, /identity\.accountType==='client'.*<RealClientPortal/s);
  assert.match(app, /identity\.roleCode!==['"]admin['"].*<RealEmployeeShell/);
  assert.match(source, /ClientDataProvider/);
  assert.match(source, /<ClientPortal clientName=/);
});

test("Client business data has no Demo persistence and all unsupported commands fail closed", () => {
  assert.doesNotMatch(data, /localStorage|sessionStorage|indexedDB|createDemoInquiries|fetch\(/);
  assert.doesNotMatch(portal, /toast\.success|DEMO_JO_DATA|B\.E\. Aerospace/);
  assert.match(data, /throw new Error\(unavailableMessage\)/);
  assert.match(data, /await clientPortalApi\.markNotificationRead/);
  assert.match(data, /controller\.abort\(\)/);
});
