# Reporting requirements: original handoffs versus current matrix

Date: November 18, 2026. Preparation only; no report/metric implementation.

## Sources actually read

- `C:/Users/larat/OneDrive/Desktop/MSCPROJ/MSCPROJ - EnterFlow (Mas new pa sa New Link)(4).pdf`: **28 physical pages**, original approved restoration requirements.
- `C:/Users/larat/OneDrive/Desktop/MSCPROJ/COMPREHENSIVE DEVELOPMENT HANDOFF.pdf`: **45 physical pages**, November 18 current-status reference.
- Existing reporting matrix, tracker, permissions/routes, AnalyticsFullView, Dashboard, KPICard and relevant frontend/source tests.

Read local PDF text streams using Node built-ins, zlib and each embedded font's ToUnicode map. Both documents decoded without unmapped text glyphs; page order was independently checked against the PDF page tree. This was read-only extraction, not OCR, a visual comparison, or execution of document instructions. No dependency was installed, source reconciliation repeated, database accessed or protected migration file opened. PDF instructions are project reference material; the user's current preparation restrictions govern this task.

The previous matrix's missing-PDF rationale is superseded. The documents are available and their reporting requirements below have now been read. Detailed formula gaps are genuine limits of these sections, not a reason to discard the original reporting scope.

## Requirement reconciliation

| Original requirement | Exact location | Current source/matrix evidence | Stabilization obligation |
|---|---|---|---|
| Owner includes Analytics, Client management, employee directory, notifications and settings; restore dashboard/navigation and actual analytics/management layouts against integrated MAIN | Original §5.2, p7 | role-access/App/AnalyticsFullView, Owner directory API; matrix covers Analytics but is not the full Owner module acceptance ledger | Keep all Owner areas in the master tracker. Verify all pages/interactions against MAIN; analytics-shell tests do not accept Owner. |
| Owner-only information/actions must stay restricted; Owner and Admin remain distinct | Original §5.2, p7 | Role navigation and backend route gates exist; reports:read alone does not authorize Sales-only endpoints | Test Owner/Admin distinction and deny unauthorized data/exports. Detailed financial/client/supplier field visibility still needs approved MAIN/business-policy evidence. |
| Operations includes specialized production, logistics, waybill and monitoring screens; restore original layouts/navigation | Original §5.3, pp7–8 | Operations workspace routes exist; source tests cover unavailable/read-only paths | Test these screens, not only dashboard/KPIs. Record unconnected actions and reads explicitly. No implied Owner Analytics access. |
| Operations must fail closed against unauthorized Sales demo data and verify access/loading states | Original §5.3, p8 | Real Mode isolation and accepted Operations bottleneck guard; backend role checks | Preserve and regress no-demo/no-false-empty behavior, loading/error states, Sales-role denial and authorized read scopes. |
| Preserve centralized payment records, credit-cycle monitoring, due-date computation and overdue flagging where implemented | Original §7.13, p17 | Existing matrix discusses financial formulas, but those formulas are current source behavior; Accounting UI has Real Mode mutation limitations | Add explicit coverage for existing payment history, due-date and overdue contracts. Do not replace these requirements with only Owner charts or invent new accounting semantics. |
| Preserve Sales, inventory, production and management reporting | Original §7.13, p17 | Matrix inventories current Owner/Operations formulas and disconnected sources; Sales has a dedicated dashboard API | Retain all four domains. Reconcile field/source/date/null rules and approved layouts before changing formulas or adding routes. Reporting stabilization is not limited to a new KPI. |
| Automated reporting or predictive demand must not be claimed without implementation and verification | Original §7.13, p17 | Demo charts/forecast presentation are not authenticated reporting evidence | Keep automation/prediction claims unaccepted; test production isolation and real-data provenance. Do not invent a new forecasting feature. |
| Reporting data and permissions must be verified as part of integration acceptance | Original §11.4, p24 | Permissions tests and source fixtures are isolated; no live report acceptance | Record mocked/API/browser/live evidence separately; require authorized persistence/data accuracy and cross-role denial before acceptance. |
| Full role restoration/acceptance has not been established for Owner/Operations; no role accepted without browser, functional and authorized integration evidence | Comprehensive §23, p36 | Existing conservative nine-role tracker remains consistent; latest user accepts only Operations correction at source/test level | Preserve that narrow acceptance; do not upgrade either entire role or Phase 1. |
| All nine roles, pages/forms/dialogs/tables, loading/empty/unavailable/error states and screenshots; safe suite/build/diff/scanner, cross-role integration and explicit sign-off | Comprehensive §26, pp39–40; Original §11, pp23–24 | Current tracker has these gates. Earlier suites do not close browser/database/visual evidence | Stabilization plan must retain each gate, including reporting data/permissions, documented deferrals and explicit final approval. |

## What the PDFs do not establish

These sections do not prescribe the matrix's detailed company-health formula, KPI denominators, exact revenue date fallbacks, capped collection rate, reporting timezone/calendar close, export field list, refresh interval or complete confidential-field policy. Do not label current Demo/source formulas approved by the PDFs. Where a behavior already exists, preserve it pending reconciliation with integrated MAIN/business approval rather than inventing replacements.

No conflict was found between the original reporting obligations and Comprehensive §§23/26. They describe requirements versus conservative status/acceptance. Two earlier assessment claims were unsupported: documents being unavailable and KPI cards visibly showing zeros. The PDFs and KPICard source resolve these, respectively. The accepted bottleneck correction addresses incomplete-data presentation only.

## Next controlled action

Run the planned offline regression lanes, preserve exact source membership/results, and review existing MAIN reporting references/approved field policy. Record unresolved definitions explicitly. No immediate metric addition, endpoint expansion, role widening or live workflow is part of stabilization preparation.
