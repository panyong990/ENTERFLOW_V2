# Production asset scanner evidence and policy

November 18, 2026. Primary reference: comprehensive handoff §§21,25–26. [Nine-section handoff](HANDOFF_REPORT.md). Scope: production JavaScript marker/integrity checks; not a general secret detector or proof of business-data visibility authorization.

## Findings and classification

[baseline-findings.csv](baseline-findings.csv) and [baseline-findings.json](baseline-findings.json) enumerate **every one of the 67 original findings**, including identifier, exact source line in src/app/store/materials.tsx, retained reconciled-manifest path/commit, generated bundle filename/hash, emitted offset, original rule and classification evidence. The baseline bundle hash identifies the inspected build; Vite later replaced generated assets during the requested rebuild.

All 67 are authentic business/catalog IDs, present as constructor argument zero in full catalog records. Their names, category, unit, price, threshold and optional supplier match the retained 71-material manifest at source commit e59364c1c9bd0257c82319df29e84081740ff694. Emitted constructor/array structure and all argument values match current source. The old scanner treated every occurrence as demo contamination without context. None was an account, session token, fabricated transaction or uploaded customer document. These are false positives of the unconditional marker rule, not authority to exempt their occurrences elsewhere.

The other four of the 71 catalog codes were previously globally exempted as legacy MaterialKey compatibility values. They now require either a full verified catalog record or the exact four-key mapping object; arbitrary occurrences fail. Four separate compatibility-map occurrences remain in the build.

Three additional findings were formerly labelled out of scope: Cabuyao, Laguna; Marikina City; Cebu City. They originate from QuotationBuilder.tsx clientAddress(), an explicitly best-effort demo customer-address map. They are not catalog identifiers or authoritative Client profile data. Real serverPreparation already initializes delivery place without that map. Added an immutable import.meta.env.DEV guard, preserving preview defaults in development and excluding the map from production. All three markers are now violations if they reappear, not ignored informational findings.

## Narrow remediation

- All **132 original prohibited literals remain** in production-asset-policy.mjs. No material code was removed from the deny rules and no 67-code exemption array was added.
- production-asset-scan.mjs parses source and bundles with the already-locked Babel parser. It never evaluates generated code.
- A catalog occurrence is classified only at the exact ID argument of a complete matching catalog array, with an eight-parameter constructor returning the expected nine fields, all 71 records/order/arguments matching source, and source metadata matching the reconciled manifest. Duplicate, partial, reordered, altered or unrelated-call contexts fail closed.
- The same code in transaction data, another string, template or comment remains a finding. A valid catalog elsewhere cannot mask it. Full-array matching intentionally fails closed if a future bundler changes representation; review that change rather than introducing a broad exemption.
- Original non-catalog markers remain failures. Unicode-escaped string values are checked after parsing; comments/raw text are checked too. Unknown material-shaped identifiers and malformed/empty JavaScript assets fail.
- Legacy compatibility requires the complete exact four-key object. No global legacy literal exemption remains.
- Existing exact @babel/parser 7.29.14 package was declared directly as a dev dependency; package resolution/version was already present in the lockfile. No install, download or dependency upgrade occurred.

## Current build result

[current-scan.json](current-scan.json): three JavaScript assets, **71 verified catalog occurrences**, **4 exact compatibility occurrences**, **0 unexplained findings**. This is not a report of 75 exemptions: classification is occurrence-specific and backed by exact structured evidence.

Static source catalog quantities are reference/demo defaults, not verified physical stock. Their continued presence is not evidence of actual counts: Real Mode catalog initialization/merge replaces unknown quantities and uses authenticated inventory. No inventory values or prices changed in this task. Broader role-based pricing visibility and whether reference prices should move to authenticated backend loading remain business/security review items from the handoff; scanner success does not close those decisions or Phase 1 acceptance.

## Commands and tests

```powershell
node --test --test-isolation=none scripts/production-asset-scan.test.mjs
npm.cmd run build
npm.cmd run check:production-demo-assets -- --write-report
npm.cmd run check:production-demo-assets
```

Scanner regression: **12 passed, 0 failed/skipped, exit 0**. Covers all 71 legitimate records/all 67 former findings, standalone duplicates, metadata/quantity/supplier tampering, unrelated constructors, missing/duplicate arrays, every retained non-catalog marker, Unicode escapes, exact legacy mapping, formerly out-of-scope defaults, unknown IDs, comments, malformed/no assets, source drift and no execution of scanned code.

See [regression-results.json](regression-results.json) for exact 67-file backend and 35-file frontend suite membership and results; handoff report contains all commands and scope exclusions. No browser, MySQL, schema/data changes, migration discovery/execution, protected Migration 007 access or Docker operations occurred.

