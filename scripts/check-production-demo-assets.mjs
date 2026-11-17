import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const assetsDirectory = join(process.cwd(), "dist", "assets");
const prohibitedLiterals = [
  "owner@enter-fil.com",
  "ops@enter-fil.com",
  "sales@enter-fil.com",
  "finance@enter-fil.com",
  "production@enter-fil.com",
  "warehouse@enter-fil.com",
  "logistics@enter-fil.com",
  "admin@enter-fil.com",
  "client@be-aerospace.com",
  "DP-receipt-BE-Mar2026.jpg",
  "PO-2026-9560",
  "JO-2026-009",
  "SI-2026-9560",
  "JO-2026-005R",
  "INQ-005R",
  "cp-seed-1",
  "PO-2026-9551",
  "SI-2026-9551",
  "DR-2026-9560-signed.jpg",
  "OILSEP-00002",
  "OILFIL-00181",
  "OILFIL-00182",
  "tpl-pocket-610",
  "tpl-air-large",
  "tpl-air-small",
  "F-FMI.FM-043",
  "F-FMI.FM-044",
  "F-FMI.FM-045",
  "F-FMI.FM-047",
  "F-FMI.FM-048",
  "F-NNWOV.FM-058",
  "F-NNWOV.FM-059",
  "F-SNNX.FM-057",
  "RM-FM-095",
  "RM-FM-096-1",
  "RM-FM-098-1",
  "RM-FM-098-2",
  "RM-FM-099-1",
  "RM-FM-100-1",
  "RM-FM-101-1",
  "RM-FM-102-1",
  "RM-FM-103",
  "RM-PFM-110",
  "RM-PFM-112",
  "F-ACWF-037",
  "F-ACWF-038",
  "F-ACG-039",
  "RM-FC-080",
  "RM-FC-083",
  "RM-FC-084",
  "RM-FC-090",
  "RM-FP-104",
  "RM-FP-108-1",
  "RM-PERPO.GI-116",
  "RM-PLATE.GI-126",
  "RM-PLATE.GI-127",
  "RM-PLATE.EG-128",
  "RM-PLATE.EG-129",
  "RM-PLATE.EG-130",
  "RM-PLATE.ALUM-131",
  "RM-PLATE.ALUM-132",
  "RM-PLATE.SS304-124",
  "RM-PLATE.SS304-125",
  "RM-PERPO.EG-120",
  "RM-PERPO.BI-121",
  "RM-PERPO.SS304-123",
  "RM-EXPNDEDMTL.BI-133",
  "RM-EXPNDEDMTL.BI-134",
  "RM-PERPO.GI-117",
  "RM-PERPO.BI-122",
  "RM-EXPNDED.ALUM-135",
  "RM-CHCKENWIRE-136",
  "RM-EMJ.EPOX-062",
  "RM-EMJ.EPOX-063",
  "RM-PSBSI-146",
  "RM-NNPAO.ADHSV-064-1",
  "RM-HNKL.ADHSV-064-2",
  "OR-NBR-STD",
  "OR-VITON",
  "GS-GREEN",
  "GS-FELT",
  "RM-SPRNGPLTESS-113",
  "RM-NAPPCO.DCCB-065",
  "RM-NAPPCO.DCCB-066-1",
  "RM-NAPPCO.DCCB-070",
  "RM-NAPPCO.CB-140",
  "RM-GSPACK.CBP-143",
  "RM-GSPACK.CBP-149",
  "RM-MLTIFLX.FB-077-1",
  "OFF-SI-137",
  "OFF-DR-138",
  "OFF-CR-139",
  "Allied Pharma standard recipe",
  "B.E. Aerospace standard recipe",
  "ASL Printing standard recipe",
  "New inquiry from Monaco",
  "INQ-007 \u00b7 50 pcs Air Oil Separator \u00b7 marked URGENT",
  "JO-2026-001 \u2192 Quality Inspection",
  "B.E. Aerospace \u00b7 Air Filter \u00b7 Stage 9 of 9",
  "Delivery dispatched: PO-2026-9531",
  "Maynilad \u00b7 Pleated Filter ZS20 \u00b7 Lalamove",
  "Receipt uploaded by client",
  "B.E. Aerospace \u00b7 \u20b123,400 \u00b7 BDO ref BDO-2026-04100",
  "Filter Media stock low",
  "Only 5 rolls left \u2014 reorder triggered",
  "Clark Freeport, Pampanga",
  "SI-2026-9901",
  "DR-2026-9901",
  "QT-2026-0418",
  "JO-2026-008",
  "QT-2026-9805",
  "SI-2026-9805",
  "DR-2026-9805",
  "supplies@maynilad.com.ph",
  "MWSS Compound, Quezon City",
  "ops@gu-eng.ph",
  "purchasing@emeraldvinyl.ph",
  "sales@monaco-ph.com",
  "OILSEP-00001",
  "procurement@be-aerospace.ph",
  "Air / Oil Separator Filter",
  "Filter Media below threshold",
  "Only 5 rolls left · reorder triggered",
  "Payment overdue: Maynilad",
  "Invoice INV-2026-0042",
  "PO-9901 needs prioritization",
  "Maynilad (recurring)",
  "PLAN-1",
  "PLAN-2",
  "SI-2026-0418",
  "SI-2026-0421",
  "Air Filter (Microglass)",
];

// These identifiers are retained by the shared legacy MaterialKey compatibility map
// in materials.tsx. They are explicitly allowed, not a broad raw-material exemption.
const documentedCompatibilityLiterals = [
  "RM-PFM-111",
  "F-LNCON.FG-042",
  "RM-PSBSI-144",
  "RM-GSPACK.CBP-148",
];

// These literals are independently retained by out-of-scope modules. They remain
// visible findings and are not classified as safe or resolved.
const knownOutOfScopeLiterals = [
  { literal: "Cabuyao, Laguna", source: "QuotationBuilder.tsx:548" },
  { literal: "Marikina City", source: "QuotationBuilder.tsx:549" },
  { literal: "Cebu City", source: "QuotationBuilder.tsx:550" },
];

const javascriptAssets = (await readdir(assetsDirectory))
  .filter((filename) => filename.endsWith(".js"))
  .sort();

if (javascriptAssets.length === 0) {
  throw new Error(`No production JavaScript assets found in ${assetsDirectory}. Run npm run build first.`);
}

const violations = [];
const compatibilityFindings = [];
const outOfScopeFindings = [];
for (const filename of javascriptAssets) {
  const contents = await readFile(join(assetsDirectory, filename), "utf8");
  for (const literal of prohibitedLiterals) {
    if (contents.includes(literal)) violations.push(`${filename}: ${literal}`);
  }
  for (const literal of documentedCompatibilityLiterals) {
    if (contents.includes(literal)) compatibilityFindings.push(`${filename}: ${literal}`);
  }
  for (const finding of knownOutOfScopeLiterals) {
    if (contents.includes(finding.literal)) outOfScopeFindings.push(`${filename}: ${finding.literal} (${finding.source})`);
  }
}

console.log(`Checked ${javascriptAssets.length} production JavaScript assets.`);
console.log(`Prohibited Demo/Materials/Clients literals: ${violations.length}.`);
console.log(`Documented legacy compatibility literals present: ${compatibilityFindings.length}.`);
for (const finding of compatibilityFindings) console.log(`  ALLOWED COMPATIBILITY: ${finding}`);
console.log(`Known out-of-scope ClientPortal and QuotationBuilder literals present: ${outOfScopeFindings.length}.`);
for (const finding of outOfScopeFindings) console.log(`  OUT OF SCOPE: ${finding}`);
if (violations.length > 0) {
  throw new Error(`Prohibited Demo/Materials literals found:\n${violations.join("\n")}`);
}
