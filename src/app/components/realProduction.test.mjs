import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = name => fs.readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

test("Real Production retains the original details and stage page with API event history and retry", () => {
  const source = read("ProductionFloor.tsx");
  for (const marker of ["useProductionJobOrders", "<ProductionEventHistory detail={remote.detail}", "remote.retryDetail", "Loading Job Orders", "No matching job orders", "<StageMonitoringPage"]) assert.ok(source.includes(marker), marker);
  const presentation = read("productionJobOrderPresentation.tsx");
  assert.match(presentation, /Production event history/);
  assert.match(presentation, /detail.productionEvents.map/);
  assert.match(read("ProductionRealJobOrders.tsx"), /export \{ ProductionFloor as ProductionRealJobOrders \} from "\.\/ProductionFloor"/);
  assert.doesNotMatch(source, /from "\.\/ProductionRealJobOrders"/);
});

test("Production detail retry re-fetches the selected detail", () => {
  const source = read("useProductionJobOrders.ts");
  assert.match(source, /const retryDetail = useCallback/);
  assert.match(source, /\[enabled, selectedId, detailVersion\]/);
});
