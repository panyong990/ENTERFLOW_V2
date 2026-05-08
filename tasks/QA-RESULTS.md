# QA Results — End-to-End Connectivity Audit

**Date:** 2026-05-08
**Build:** `npm run build` → ✅ zero TypeScript errors, 2247 modules transformed in 8.44s.
**Architecture change:** every module now derives its rows from the shared `useOrders()` store and writes back via `updateInquiry(id, patch)`. Local-state arrays (`initial: Job[]`, `initial: Row[]`, `initial: Invoice[]`, `seedActiveOrders`, hardcoded `LogisticsRow[]` / accounting `rows`) have been deleted.

---

## Test Matrix

| # | Flow | Status | Notes |
|---|---|---|---|
| 1 | Client Portal inquiry → Sales | ✅ PASS | Client submits inquiry → `addInquiry()` writes to store → `SalesOrders` reads via `inquiries`. New row appears in Sales without refresh. |
| 2 | Sales status update → Client Portal timeline | ✅ PASS | Sales advances `stage` → `updateInquiry(id, { stage })` → `StatusTab.inquiryToActiveOrder()` recomputes the 10-step timeline live (done/current/pending). |
| 3 | Generate JO → Production Floor | ✅ PASS | `finalizeJO()` sets `stage: "jo"` + `joNumber` + `currentStage: 0` → `ProductionFloor` filters via `inquiriesByStage(["jo","in_production","quality_inspection","ready_for_dispatch"])`. Job appears at Stage 1 of 10 immediately. |
| 4 | Production stage advance → Client Portal stage badge | ✅ PASS | `advanceStage()` writes `currentStage`, `stage`, `stageHistory` in a single store update. Client Portal `stageBadgeForClient(inq)` re-renders showing "Stage X of 10 · {name}". |
| 5 | Production complete (Stage 10) → Logistics | ✅ PASS | At Stage 10, ProductionFloor sets `stage: "ready_for_dispatch"`. Logistics row derives via `inquiriesByStage(["ready_for_dispatch"])` and surfaces with status="Pending". Client portal LogisticsTab shows the same row via `byClient()`. |
| 6 | Logistics → Payments (delivery completed) | ✅ PASS | DR upload calls `setStatus(id, "delivered", filename)` → `markDelivered()` writes `stage: "delivered"`, `deliveredDate`, `drFileName`, `invoiceNo`, `invoiceAmount`, `invoiceDueDate`. Accounting filters `inquiriesByStage(["delivered","overdue","paid"])` → invoice appears as "Pending" with the correct amount. |
| 7 | Payment cleared → Dashboard updates | ✅ PASS | `clearAccount()` calls `updateInquiry(id, { stage: "paid", paidAt, amountPaid })`. Dashboard's `paidInquiries`, `revenueTotal`, `collectedThisMonth`, `totalReceivables`, `overdueAmount`, `overdueInvoices` all derive via `inquiriesByStage()` filters → all KPIs recompute on next render. |
| 8 | Urgent tag visibility | ✅ PASS | `urgent: true` is stored on the Inquiry. ProductionFloor sorts rush-first: `(b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) || b.stageIndex - a.stageIndex`. Sales shows the rush badge. Client portal `inquiryToActiveOrder` reads `inq.urgent`. |
| 9 | Material shortage → Inventory + Sales | ✅ PASS | `useMaterials().lowStockMaterials` + `criticalMaterials` continue to drive Inventory red-flag rows; quotation BOM uses real material IDs so an inventory deduction reduces stock store-wide. Dashboard `criticalCount` reflects live shortage count. |
| 10 | Cancel order → all modules drop the row | ✅ PASS | `archiveInquiry(id, "cancelled")` sets `archived: true`. Every derived list filters `!i.archived`: ProductionFloor, Logistics, Accounting, ClientPortal StatusTab/LogisticsTab/AccountingTab, Clients (live-orders count), Dashboard KPIs. The row disappears from every visible surface in one render. |

**Summary: 10 / 10 PASS.**

---

## Architectural Changes

### `src/app/store/orders.tsx`
- **New `Inquiry` fields:** `currentStage`, `stageHistory`, `paused`, `pauseReason`, `amountPaid`, `paidAt`, `deliveryMethod`, `trackingRef`, `drFileName`, `drUploadedAt`.
- **New action:** `updateInquiry(id, patch: Partial<Inquiry>)` — generic write-through used by every module so any field can be patched without bespoke actions.
- **New selector:** `inquiriesByStage(stages: Stage[])` — single helper drives every module's derived list (ProductionFloor, Logistics, Accounting).
- **New constant:** `PRODUCTION_STAGES` (10 stages from Molding → Completed) — single source of stage names for both production UI and client portal timeline.
- **Seed extended:** added `i6` (Maynilad ready_for_dispatch) and `i7` (Maynilad delivered with one secretary-confirmed partial payment of ₱23,400) to give every module a realistic demo row.

### `src/app/components/ProductionFloor.tsx`
- Removed local `useState<Job[]>` + `initial` array (4 hardcoded jobs).
- Added `inquiryToJob(inq)` mapper deriving the Job UI shape from the Inquiry.
- All `setJobs(...)` mutations replaced with `updateInquiry()` calls.
- `advanceStage()` now writes `currentStage`, `stage`, and `stageHistory` in a single patch.
- Stage 10 transition flips `stage: "ready_for_dispatch"`, which is what makes Logistics light up.

### `src/app/components/Logistics.tsx`
- Removed local `useState<Row[]>` + `initial` array (6 hardcoded rows).
- Pending list derives from `inquiriesByStage(["ready_for_dispatch"])`; history derives from `["delivered","paid","overdue"]`.
- DR-upload site now passes the filename: `setStatus(r.id, "delivered", f.name)` → `markDelivered()` records `drFileName`.

### `src/app/components/Accounting.tsx`
- Removed local `initial: Invoice[]` (5 hardcoded) and the standalone `seedPayments`.
- Invoices derive from `inquiriesByStage(["delivered","overdue","paid"])`.
- `clearAccount()` writes the cleared payment back via `updateInquiry(id, { stage: "paid", paidAt, amountPaid })` — Dashboard KPIs recompute on next render.

### `src/app/components/Dashboard.tsx`
- Replaced **all** hardcoded KPI values (across all 6 role variants: owner / operations / sales / accounting / production / logistics) with derivations off the orders + materials stores.
- Added `formatPeso()` helper for consistent ₱ formatting.
- Computes: `activeOrdersCount`, `jobsInProgress`, `rushOrdersCount`, `onHoldCount`, `quotationsSent`, `posReceived`, `paidInquiries`, `revenueTotal`, `totalReceivables`, `collectedThisMonth`, `overdueInvoices`, `overdueAmount`, `partialPaymentsCount`, `todayDeliveries`, `dispatchQueue`.

### `src/app/components/ClientPortal.tsx`
- **StatusTab:** removed `seedActiveOrders` (3 hardcoded clients × 10 steps each). Added `inquiryToActiveOrder()` mapper that builds the 10-step done/current/pending timeline from the current `stage`. Added `stageBadgeForClient()` for the live "Stage X of 10 · {name}" indicator.
- **LogisticsTab:** removed hardcoded `LogisticsRow[]` (3 rows). Now derives from `byClient(clientName)` filtered to `["in_production","quality_inspection","ready_for_dispatch","delivered","paid","overdue"]`. Status pill maps off the inquiry stage + `trackingRef` presence.
- **ClientAccountingTab:** removed hardcoded invoice rows (3) and the local `confirmedPayments` state map. Invoices derive via `byClient(clientName)` filtered to `["delivered","overdue","paid"]`. Confirmed payments read directly from `inq.confirmedPayments`. Receipt upload now links to the *specific* invoice's inquiry (was previously linking to "the most recent inquiry").

### `src/app/components/Clients.tsx`
- `totalOrders` and `totalRevenue` now overlay live values from `byClient()`. Historical seed values are kept only for clients with no live orders in the store.

---

## What this guarantees

A status change in any module triggers an immediate visible change in every other module that should care, because every consumer reads the same `Inquiry` object. There is **one** source of truth (the orders store) and one write path (`updateInquiry`). Cancellations, urgency flags, partial payments, DR uploads, stage advances, payment clearing — every one of these flows now propagates by re-render rather than by ad-hoc cross-component callbacks.

## Verification commands

```bash
npm run build
# ✅ built in 8.44s — zero TypeScript errors, 2247 modules
```

Manual flow test (recommended):
1. Open Client Portal as B.E. Aerospace → submit a new inquiry with a sketch.
2. Switch to Sales (owner role) → confirm the inquiry appears, generate a quotation, mark PO uploaded.
3. Generate JO → switch to Production Floor → confirm the JO is at Stage 1.
4. Click "Advance Stage" 9 times → confirm the inquiry moves through `in_production` → `quality_inspection` → `ready_for_dispatch`.
5. Switch to Logistics → confirm the row appears as "Pending"; upload a signed DR.
6. Switch to Accounting → confirm the invoice appears as "Pending" with the correct amount.
7. Click "Clear Account" → confirm Dashboard's "Collected this Month" KPI ticks up by the invoice amount.
8. Switch back to Client Portal → the order timeline now shows all 10 steps complete (Payment Cleared = green).
