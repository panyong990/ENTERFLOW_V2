# Production/security disposition — November 18, 2026

Dependency follow-up: the current public registry/advisory was rechecked. **No verified compatible patch exists:** latest picomatch 4.0.7 remains affected; no patched version listed; latest Vite 6 remains 6.4.6. Fresh audit: exit 1, four high affected entries, same root advisory. No package/lockfile/dependency change; no post-change full tests/build/scan were claimed. Per the user's explicit stop rule, no out-of-range downgrade, major change, force, override or custom patch was attempted. [Blocked remediation review](../dependency-review-2026-11-18/REVIEW.md) and its evidence are the latest dependency disposition. Original audit/execution history below is preserved. The external-script hold is unchanged.

**Release assessment: HOLD. Functional safe regressions passed; security approval is not established.** This document records the assessment, not a new automated deployment gate or a risk-acceptance waiver. No deployment is performed or authorized here.

## External design-capture script

Confirmed source `index.html:14` and generated `dist/index.html:15` load `https://mcp.figma.com/mcp/html-to-design/capture.js` asynchronously. It is already present in HEAD, not introduced by the registration/cancellation/Operations work. The fresh production build retains it; [bundle-correlated scan](production-scan.json) records the source/output HTML hashes and external script count.

Disposition for this stabilization execution: **retain existing source unchanged; do not accept this artifact for production deployment pending either scoped removal/production exclusion or explicit documented security approval.** No remote script was fetched, run or browser-inspected, so no claim is made about its implementation, data collection, exploitability or maliciousness. There is no evidence in the approved Phase 1 requirements that this design-capture helper is required for business workflows. Its remote code is outside the local JS marker scanner; zero scanner findings are not approval of this script.

Next review must choose removal/production exclusion with regression coverage and a fresh build/HTML check, or explicitly authorize retention with a justified trust/data-handling policy. This is a release blocker, not a fix to registration/business rules. No script or existing work was silently deleted to make a gate green.

## Dependency audit

`npm.cmd audit --json --ignore-scripts` exited **1**: 4 high affected package entries, 0 critical/moderate/low/info. These are not four distinct root advisories. Confirmed tree:

```text
vite@6.4.6
  fdir@6.5.0 -> picomatch@4.0.4
  picomatch@4.0.4
  tinyglobby@0.2.16 -> fdir / picomatch
```

All four lockfile entries are `dev:true`; Vite is declared under devDependencies as `^6.4.6`. This locates the reported dependency exposure; it does not prove deployed/runtime safety or attacker-controlled glob reachability. No exploitation test or application service was run.

The registry reports [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), a picomatch ReDoS advisory affecting versions through 4.0.7. The reviewed primary advisory lists **no patched version** as of this review. No patched upgrade is asserted. npm's suggested Vite 6.2.7 change is a downgrade outside the declared range, flagged semver-major by the audit; it was not applied and has not been established as a compatible/sufficient remediation.

Disposition: **dependency security gate FAIL / remediation review required**. No audit fix/force, override, install, dependency removal or lockfile edit. Preserve the current reproducible test evidence. A separately scoped dependency review should confirm available upstream remediation, compatibility with Vite/plugins/build, actual affected-input reachability and renewed audit results; document an explicit risk decision if no safe patch exists. Do not weaken tests, suppress the advisory or treat devDependency classification as automatic acceptance.

[Machine-readable dependency evidence](dependency-audit.json). The public advisory/registry check was the only security network lookup; no application/database endpoint, credential or protected migration was involved.

## Other security evidence and limits

Existing authentication/session/RBAC/origin/ownership/redaction regressions passed in isolated focused/full suites. No live accounts, browser, database persistence, penetration test, cloud access or complete secret-scanning assessment. These results do not supersede the two release holds above or remaining nine-role acceptance requirements.
