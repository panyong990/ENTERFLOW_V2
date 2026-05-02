Completely redesign the Inventory & Procurement page.
This page has TWO purposes only:
1. Monitor 3 critical raw material stock levels
2. Generate and print barcode waybill labels 
   for finished goods before shipment

Remove everything else:
- Remove "Order Raw Materials from Supplier" button
- Remove Job Order Material Checks panel
- Remove Inbound / Transfer / Dispatch buttons
- Remove the 4 KPI cards (Raw Materials 139, etc.)
- Remove Recent Scans list

Rename page to: "Inventory & Waybill"
Subtitle: "Critical stock monitoring · 
Finished goods barcode & waybill generation"

════════════════════════════════════════════════
SECTION 1 — CRITICAL MATERIALS MONITOR
════════════════════════════════════════════════

Title: "Critical Stock Levels"
Right-aligned subtitle: 
"Updated manually · No auto-deduction 
(no standard measurement per filter)"

4 material cards in a row:

CARD 1 — Filter Media (Local)
  Icon: 🧻
  Stock: 12 rolls (large bold number)
  Threshold: Alert below 5 rolls
  Lead Time: Next day (local supplier)
  Status badge: ✅ OK (green)
  Last updated: Apr 26 · Tricia
  [📝 Update Count] small outlined button

CARD 2 — Filter Media (Imported)  
  Icon: 🌐
  Stock: 8 rolls (large bold number)
  Threshold: Batch purchase (no threshold)
  Lead Time: Months · Bureau of Customs
  Status badge: 📅 SCHEDULE-BASED (blue)
  Next import batch: May 15, 2026 [editable]
  Last updated: Apr 26 · Tricia
  [📝 Update Count] small outlined button

CARD 3 — Adhesive
  Icon: 🔧
  Stock: 2 sets (large bold number, RED)
  Threshold: Alert below 3 sets
  Lead Time: Next day (local supplier)
  Status badge: 🔴 LOW STOCK (red)
  Last updated: Apr 26 · Tricia
  [📝 Update Count] small outlined button
  RED BORDER on this card — critical alert

CARD 4 — Corrugated Box
  Icon: 📦
  Stock: 45 pcs (large bold number, AMBER)
  Threshold: Alert below 50 pcs
  Lead Time: ~2 weeks
  Status badge: ⚠️ LOW STOCK (amber)
  Last updated: Apr 26 · Tricia
  [📝 Update Count] small outlined button
  AMBER BORDER on this card

UPDATE COUNT MODAL (when button clicked):
  Title: "Update Stock — Adhesive"
  Current: 2 sets
  New count: [number input — large, easy to tap]
  Reason: [dropdown]
    · Physical count / recount
    · New stock received
    · Used in production
    · Correction
  Notes: [optional text]
  [💾 Save] red button

Stock History (collapsible below each card):
  "📋 View history" small link
  Table: Date · User · Old → New · Reason
  Apr 26 · Tricia · 5 → 2 sets · Used in production
  Apr 20 · Tricia · 0 → 5 sets · New stock received

════════════════════════════════════════════════
SECTION 2 — BARCODE WAYBILL GENERATOR
════════════════════════════════════════════════

Title: "Finished Goods Waybill"
Subtitle: "Generate and print shipping labels 
for completed job orders before dispatch"

TWO WAYS TO USE THIS:

WAY 1 — SCAN existing barcode
Large dashed input box (full width):
  📷 icon left side
  "Scan barcode or type JO/PO number..."
  "READY TO SCAN" badge right side

WAY 2 — SELECT from completed JOs
Dropdown: "Or select a completed Job Order ▼"
  Shows list of JOs marked complete 
  but not yet dispatched:
  JO-008 · ARNEL · Air Filter · 100 pcs
  JO-007 · B.E. Aerospace · Air Filter · 50 pcs

─── WAYBILL PREVIEW (shown after scan or selection) ───

When a JO is selected or scanned, show:

LEFT: WAYBILL PREVIEW CARD (print-ready layout)

┌─────────────────────────────────────────────────┐
│ ▲ ENTER-FIL INDUSTRIAL PRODUCTS                │
│ [company address] · [phone]                     │
│ ════════════════════════════════════════════   │
│                                                 │
│ SHIP FROM:                  SHIP TO:            │
│ Enter-Fil Industrial        ARNEL               │
│ Products                    M. Rivera           │
│ [company address]           [client address]    │
│ +63 2 XXX XXXX              +63 917 XXX XXXX   │
│                                                 │
│ ────────────────────────────────────────────── │
│ ORDER DETAILS:                                  │
│ JO No.: JO-008                                  │
│ PO No.: PO-2026-0740                            │
│ SI No.: SI-2026-0740                            │
│ Item: Air Filter 115×220×500mm                  │
│ Quantity: 100 pcs                               │
│ Delivery Method: Company Vehicle                │
│ ────────────────────────────────────────────── │
│                                                 │
│ [BARCODE IMAGE — auto-generated]                │
│ FP-2026-05236                                   │
│                                                 │
│ Date: Apr 26, 2026                              │
│ Prepared by: Tricia · Management                │
└─────────────────────────────────────────────────┘

RIGHT: ACTIONS PANEL

[🖨 PRINT WAYBILL LABEL] — RED, full width, large
"Prints A6 / 4×6 inch label for box"

[📄 DOWNLOAD PDF] — outlined button

[✅ MARK AS DISPATCHED] — navy button
"Updates logistics status to In Transit 
and notifies client portal"

Dispatch confirmation dialog:
┌─────────────────────────────────────────────────┐
│ ✅ Confirm Dispatch                             │
│                                                 │
│ JO-008 · ARNEL · 100 pcs Air Filter            │
│ Will be marked: In Transit                      │
│ Client will be notified automatically           │
│                                                 │
│ [Cancel] [✅ Yes, Mark Dispatched]              │
└─────────────────────────────────────────────────┘

After dispatch confirmed:
- Toast: "JO-008 dispatched · Client notified"
- Logistics & Billing status → In Transit
- Client portal Logistics tab → In Transit 🚚
- JO removed from waybill generator 
  (it's been dispatched, nothing to print)

─── RECENTLY PRINTED WAYBILLS ───
(below the generator, simple log)

Title: "Recently Generated Waybills"
Table: DATE · JO NO. · CLIENT · ITEM · QTY · 
       DISPATCHED · ACTIONS

Row: Apr 26 · JO-008 · ARNEL · Air Filter · 
     100 pcs · ✅ Yes · [🖨 Reprint]

[Reprint] = regenerates same waybill PDF for reprinting
"In case label is damaged or lost"

════════════════════════════════════════════════
DESIGN NOTES
════════════════════════════════════════════════

Page layout: 
  Section 1 (Critical Materials) — top, full width
  Section 2 (Waybill Generator) — bottom, 
  two-column (60% preview / 40% actions)

Only LOW STOCK cards have colored borders.
Everything else: white cards, clean, minimal.

This page is used by production and logistics staff
who are not technical — keep it simple and obvious.
Big buttons. Clear labels. No jargon.