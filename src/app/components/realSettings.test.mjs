import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const settings = await readFile(new URL("./Settings.tsx", import.meta.url), "utf8");
const store = await readFile(new URL("../store/settings.tsx", import.meta.url), "utf8");
const shell = await readFile(new URL("./RealEmployeeShell.tsx", import.meta.url), "utf8");
const workspace = await readFile(new URL("./RealRoleWorkspace.tsx", import.meta.url), "utf8");

test("Real Mode routes to the existing complete Settings screen", () => {
  assert.match(workspace, /route === "settings"\) return <Settings \/>/);
  assert.match(shell, /<SettingsProvider mode="real">/);
  for (const section of ["Company Information", "Contact Details", "Delivery Defaults", "Notification Preferences", "Document Footer"]) assert.match(settings, new RegExp(section));
});

test("Real Settings excludes Demo values and blocks false persistence", () => {
  assert.match(store, /realUnavailableSettings/);
  assert.match(store, /mode === "real" \? realUnavailableSettings : defaults/);
  assert.match(settings, /no authenticated profile, company-settings, password/);
  assert.match(settings, /Settings save is unavailable/);
  assert.match(settings, /disabled=\{unavailable\}/);
  assert.match(settings, /readOnly=\{realMode\}/);
  assert.match(settings, /if \(realMode\)/);
  assert.match(settings, /toast\.success\("Settings saved"/);
});

test("Demo Settings still uses the original store-backed save path", () => {
  assert.match(store, /mode = "demo"/);
  assert.match(settings, /save\(\);/);
  assert.match(settings, /SAVE SETTINGS/);
});
