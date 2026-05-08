# QA Findings — End-to-End Flow Audit

**Audit date:** April 2026 (build snapshot)
**Method:** code-walk through `src/app/store/orders.tsx` and every consumer component, flagging every place where a status change in one module should trigger a visible change in another module but currently doesn't.

---

## Reads / Writes Map

| Module                | Reads from `useOrders()`                                                | Writes to `useOrders()`                                                                       | Local seed (independent of store)                                            |
| --------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **App.tsx**           | `inquiries`, `unreadFor`                                                | —                                                                                             | —                                                                            |
| **ClientPortal.tsx**  | `byClient`, `addInquiry`, `uploadPO`, `requestCancellation`, `addClientReceipt`, `reorderToProduction` | ✅ writes back inquiries                                                                       | ⚠️ `seedActiveOrders` for Status tab · `completedJobOrders` for past-orders table · local `rows` for ClientAccountingTab + LogisticsTab |
| **SalesOrders.tsx**   | `inquiries`, `archivedInquiries`, `isNewClient`                         | ✅ `addInquiry`, `sendQuotation`, `uploadPO`, `finalizeJO`, `rejectInquiry`, `setBillOfMaterials`, `setQuotationDoc` | —                                                                            |
| **ProductionFloor**   | `completedJOs`, `setStage`, `cancelJOFromProduction`                    | ⚠️ partial — calls `setStage` only at stage 0→1 and certain transitions                       | ❌ **`const initial: Job[]` + `const [jobs, setJobs] = useState(initial)` — fully independent of store. Stage advances mutate local jobs, not store inquiries.** |
| **Logistics.tsx**     | `clearedPOs`, `completedJOs`, `markDelivered`                           | ⚠️ `markDelivered` called when DR uploaded but only matches by partial PO substring           | ❌ **`const initial: Row[]` hardcoded.** Delivery rows do not derive from `completedJOs.filter(stage==="ready_for_dispatch")`. |
| **Accounting.tsx**    | `byClient`, `markPOCleared`, `confirmClientPayment`                     | ⚠️ writes confirmed payments + cleared flag                                                   | ❌ **`const initial: Invoice[]` hardcoded.** Invoices never derive from inquiries marked `delivered`. New invoices from `markDelivered` are never reflected here. |
| **Dashboard.tsx**     | `inquiries`                                                             | —                                                                                             | ❌ **All KPIs are hardcoded string literals** ("12", "8", "₱1.2M", etc.). Active Orders, Jobs In Progress, Revenue, Low Stock all static. |
| **Inventory.tsx**     | (uses `useMaterials`)                                                   | (uses `useMaterials`)                                                                         | ✅ properly derived                                                           |
| **Clients.tsx**       | `byClient`                                                              | `reorderToProduction`                                                                         | ⚠️ `totalRevenue` and `transactions` come from `CLIENTS_DATA` seed — never recompute from inquiries |

---

## Test-by-test results (BEFORE fixes)

### TEST 1 — Client Portal → Sales & Orders
- **Status:** ✅ PASS
- `ClientPortal.OrdersTab.submit()` → `addInquiry()` → store → `SalesOrders` reads from `inquiries` filter. The inquiry shows up.
- ⚠️ Caveat: Dashboard's "Active Orders" KPI is hardcoded "12" so it does NOT increment.

### TEST 2 — Sales & Orders → Client Portal (quotation sent)
- **Status:** ❌ FAIL
- `sendQuotation()` correctly updates `stage` in the store.
- BUT `ClientPortal.StatusTab` reads from `seedActiveOrders` (lines 968-1013), a hardcoded array that never reflects store changes.
- The client never sees the "Quotation Received" stage update.

### TEST 3 — Generate JO → Production Floor
- **Status:** ❌ FAIL
- `finalizeJO()` correctly moves the inquiry to `stage: "jo"` in the store.
- BUT `ProductionFloor` reads from `const initial: Job[]` (line 79) + `useState(initial)` (line 185).
- Newly generated JOs never appear in Production Floor. Only the 4 hardcoded jobs ever show.
- Dashboard "Jobs In Progress" is hardcoded "8" — does not increment either.

### TEST 4 — Production Stage Advance → Client Portal
- **Status:** ❌ PARTIAL FAIL
- `advanceStage()` mutates LOCAL `jobs` state in ProductionFloor.
- It DOES call `syncInquiryStage(j, newIdx)` → `setStage(inq.id, mappedStage)` for some transitions, BUT:
  - The mapping only handles 4 transitions (in_production / quality_inspection / ready_for_dispatch / jo)
  - `currentStage` field is NOT set on the inquiry — only `stage` enum changes
  - Client portal still reads `seedActiveOrders` so even the stage update isn't visible

### TEST 5 — Production Complete → Logistics
- **Status:** ❌ FAIL
- Stage 9→10 in ProductionFloor calls `pushNotif` for ready-for-dispatch but does NOT call `setStage(id, "ready_for_dispatch")`.
- Logistics reads `const initial: Row[]` — fully independent. New ready-for-dispatch JOs never become deliveries.
- The fix-target architecture (derive Logistics rows from `completedJOs.filter(stage === "ready_for_dispatch")`) is not implemented.

### TEST 6 — Logistics Delivered → Payments Ledger
- **Status:** ❌ FAIL
- DR upload calls `setStatus(id, "delivered")` and `markDelivered()` on the orders store.
- BUT Accounting's `rows` is hardcoded `const initial: Invoice[]`. The new invoice created by `markDelivered` never appears here.
- The matching logic in `markDelivered` is best-effort (PO substring match) and is fragile.

### TEST 7 — Payment Cleared → Dashboard + History
- **Status:** ❌ FAIL
- `clearAccount()` in Accounting calls `markPOCleared()` correctly.
- Logistics filters `activeRows.filter(r => !clearedPOs.includes(r.po))` — this works for the hardcoded rows but doesn't help when Logistics rows aren't store-derived in the first place.
- Dashboard Revenue KPI is hardcoded "₱1.2M". Doesn't update.
- Client Management `totalRevenue` is from `CLIENTS_DATA` seed — never recomputes.

### TEST 8 — Urgent/Rush Tag Visibility
- **Status:** ⚠️ PARTIAL PASS
- `inquiry.urgent` shows on SalesOrders kanban cards ✅
- ProductionFloor `Job` interface has `urgent?: boolean` and renders RUSH banner ✅, BUT only because the seed data has `urgent: true`. Newly generated JOs (which only live in store, not in local jobs) never reach ProductionFloor at all.
- Sort-to-top: not enforced — order is seed-array order.

### TEST 9 — Material Shortage → Pause + Resume
- **Status:** ⚠️ PARTIAL — works for the 4 seeded jobs but not for newly generated JOs (same root cause as Test 3)
- `deductForJO()` in materials store works correctly when called.
- ProductionFloor calls it on stage 0→1 if BOM is present. But if a JO never appeared in the local jobs list, this never runs.

### TEST 10 — Cancel Order (Client-side) → All Modules
- **Status:** ⚠️ PARTIAL PASS
- Client cancellation calls `requestCancellation()` correctly.
- SalesOrders shows the pending banner with accept/decline ✅
- BUT: if the inquiry is `in_production`, ProductionFloor doesn't show the pending-cancellation banner because ProductionFloor's local jobs aren't tied to the store inquiry.

---

## Root cause (the one architectural problem)

> **Every "active table" module (ProductionFloor, Logistics, Accounting) has its own local `useState` seeded with hardcoded rows. None derive from the shared orders store.**

Concrete locations:

| File                  | Line(s)      | Issue                                                                |
| --------------------- | ------------ | -------------------------------------------------------------------- |
| `ProductionFloor.tsx` | 79–104       | `const initial: Job[]` — 4 hardcoded jobs                            |
| `ProductionFloor.tsx` | 185          | `const [jobs, setJobs] = useState<Job[]>(initial)` — local state     |
| `Logistics.tsx`       | 29–37        | `const initial: Row[]` — 6 hardcoded delivery rows                   |
| `Logistics.tsx`       | 87           | `const [rows, setRows] = useState<Row[]>(initial)` — local state     |
| `Accounting.tsx`      | 32–38        | `const initial: Invoice[]` — 5 hardcoded invoices                    |
| `Accounting.tsx`      | 85           | `const [rows, setRows] = useState<Invoice[]>(initial)` — local state |
| `Dashboard.tsx`       | 152–155, etc | All KPI numbers are hardcoded string literals                         |
| `ClientPortal.tsx`    | 968–1003     | `const seedActiveOrders` — independent of store                       |

---

## Fix plan

The fix is the same architectural pattern in each file: **stop seeding local state, derive everything from `useOrders().completedJOs` (or `inquiries`).**

### Required store extensions
- Add `currentStage: number` to `Inquiry` (0–9 production stage index, set as the order moves through production)
- Add `stageHistory: { stage: number; completedAt: string; completedBy: string; reason?: string }[]`
- Add `paused: boolean` + `pauseReason?: string`
- Add `amountPaid: number` derived helper (or kept on Inquiry)
- Add a generic `updateInquiry(id, patch: Partial<Inquiry>)` action — replaces a dozen single-purpose setters

### File-by-file fixes
1. **orders.tsx** — extend `Inquiry`, add `updateInquiry()`, expose `inquiriesByStage(stages: Stage[])` helper
2. **ProductionFloor.tsx** — derive `jobs` from `completedJOs.filter(stage in [jo, in_production, quality_inspection, ready_for_dispatch])`. Each card's data is built from `Inquiry` directly. Remove `const initial: Job[]`. Stage advance writes back via `updateInquiry()`.
3. **Logistics.tsx** — derive active deliveries from `completedJOs.filter(stage === "ready_for_dispatch" || stage === "delivered")`. Remove `const initial: Row[]`. DR upload writes back to store.
4. **Accounting.tsx** — derive invoices from `completedJOs.filter(stage === "delivered" || stage === "paid" || stage === "overdue")`. Remove `const initial: Invoice[]`. Invoice number/date/due come from inquiry's invoice fields populated by `markDelivered`.
5. **Dashboard.tsx** — replace hardcoded KPIs with computed values from `inquiries` + `completedJOs` + `clearedPOs` + `useMaterials()`.
6. **ClientPortal.tsx** — Status tab reads from `byClient(clientName)` and renders the timeline from each inquiry's stage. Remove `seedActiveOrders`. Logistics tab + Accounting tab same pattern.
7. **Clients.tsx** — recompute `totalRevenue`, `totalOrders`, transactions list from `byClient()`.
8. Wire **inventory deduction** correctly: when stage 0→1 happens via `updateInquiry`, look up BOM and call `deductForJO` (already implemented but on local state).

### Notification triggers to add
- Stage 9 reached → notify Logistics
- Stage 10 reached → status `ready_for_dispatch` → notify Logistics
- Delivered status → notify Accounting (already done, but verify it fires)
- Paid → notify Sales + Operations + Owner
- Holding → notify Warehouse + Operations
