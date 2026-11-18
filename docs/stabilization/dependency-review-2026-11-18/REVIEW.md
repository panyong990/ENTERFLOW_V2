# Dependency remediation review — November 18, 2026

## Outcome

**BLOCKED: no verified patched compatible package is available. No dependency change applied. Security gate remains failed.** Stopped before any out-of-range/incompatible change, as instructed. No npm audit fix/force, suppression, ignore rule, manual finding deletion, override, installation or lockfile regeneration.

## Original advisory and confirmed dependency paths

Advisory: [GHSA-fc5q-39xc-vjpf / CVE-2026-112366](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), picomatch ReDoS through repeated extglobs. The current primary advisory affects versions **<=4.0.7** and lists **no patched version**. Reviewed against the public advisory and npm registry, not inferred from the old report.

| Package | Installed | Relationship | Relevant declared dependency |
|---|---|---|---|
| vite | 6.4.6 | Direct devDependency; also shared by Tailwind/Vite and React/Vite plugins | Root ^6.4.6; existing pnpm override pins 6.4.6 |
| picomatch | 4.0.4 | Transitive, deduplicated | vite ^4.0.2; tinyglobby ^4.0.4 |
| fdir | 6.5.0 | Transitive under Vite and tinyglobby | Vite ^6.4.4; tinyglobby ^6.5.0; optional picomatch peer ^3 or ^4 |
| tinyglobby | 0.2.16 | Transitive under Vite | Vite ^0.2.13 |

All four lockfile entries are dev:true. Paths include Vite→picomatch, Vite→fdir→picomatch, and Vite→tinyglobby→picomatch/fdir→picomatch. They are four affected entries driven by one root advisory, not four independent advisories. Dev classification does not establish runtime/build-input safety or grant risk acceptance.

## Compatible patch review and stop boundary

`npm view picomatch version dist-tags versions --json` reports latest **4.0.7** and a published-version list ending at 4.0.7. Every available version in that response is within the advisory range. Updating 4.0.4 to 4.0.7 would leave the original advisory unresolved; it is not a security fix.

`npm view vite@6 version --json` lists **6.4.6** as the latest Vite 6 version. No newer compatible Vite 6 patch was found to evaluate under the root ^6.4.6 range. npm audit suggests Vite **6.2.7**, flags the change semver-major, and this downgrade falls outside ^6.4.6 and conflicts with the existing pnpm 6.4.6 pin. No compatibility/security sufficiency is established for that downgrade. It was not applied. A different major, fork, forced override, custom dependency patch or dependency removal would need a separately reviewed scope and is not silently substituted.

Consequently no safe exact package edit can be justified within current constraints. Package scripts/configuration and the existing Babel parser declaration remain unchanged. No unrelated dependencies or node_modules were modified. No lockfile change, large or small, was generated.

## Actual commands and verification

```powershell
npm.cmd ls vite fdir tinyglobby picomatch --all
npm.cmd view picomatch version dist-tags versions --json
npm.cmd view vite@6 version --json
npm.cmd audit --json --ignore-scripts
git diff --check
```

Tree/registry metadata checks succeeded (exit 0). Fresh audit exited **1**: **4 high, 0 critical/moderate/low/info**, same four affected packages and original advisory. No new advisory appeared in the refreshed audit; this is not an audit pass or a remediation claim. Exact responses, constraints and pre-review file fingerprints are in [review-evidence.json](review-evidence.json).

Complete backend/frontend tests, production build and scanner were **NOT RUN in this review**: no dependency change was made and the explicit stop condition was reached. Previous stabilization results (844 backend, 218 frontend, scanner 12, build/production scan passed) remain historical; they are not post-remediation evidence. No tests weakened or existing business behavior changed.

Post-review fingerprint checks confirm package.json, package-lock.json, the prepared baseline/test inventory, and all 102 inventoried test files unchanged. Diff check exits 0; detailed evidence is retained separately. Prior shared modifications remain intact.

## Exact files changed

- docs/stabilization/dependency-review-2026-11-18/REVIEW.md — new review and stop rationale.
- docs/stabilization/dependency-review-2026-11-18/review-evidence.json — new registry/audit/path evidence.
- docs/stabilization/dependency-review-2026-11-18/preservation-check.json — new final comparison.
- docs/stabilization/execution-2026-11-18/EXECUTION_REPORT.md — added latest blocked-review pointer; prior execution evidence retained.
- docs/stabilization/execution-2026-11-18/SECURITY_DISPOSITION.md — added latest verified no-patch disposition; hold retained.
- PHASE_1_MASTER_PROGRESS_TRACKER.md — updated current dependency blocker/next action; all original requirements retained.

**No package or version changed.** The smallest package change meeting the security objective cannot currently be verified.

## Database Change Report

No database operations/connections/SQL, migrations/imports/schema/data changes, Docker, browser or cloud workflows. Protected Migration 007 and checksum/history untouched and uninspected. No application services started, account/session operations or credentials accessed. Public registry/advisory reads only.

## Next step

Choose a separately scoped compatibility/security evaluation of an out-of-range alternative, or recheck upstream for an actual patched compatible release. Do not approve a vulnerable same-range update or rely on npm's downgrade suggestion without compatibility/security evidence. Once a safe candidate is established and authorized, apply only the reviewed package/lockfile delta, inspect that delta before installation, and run the requested full safe tests/build/current-bundle scan/fresh audit. Retain both security holds until their own evidence supports closure; the external capture-script hold is separate and unchanged.

Phase 1 and dependency security acceptance remain incomplete. No waiver or risk acceptance is granted by this report.
