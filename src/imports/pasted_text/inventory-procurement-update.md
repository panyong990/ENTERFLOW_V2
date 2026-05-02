Update the Inventory & Procurement page to match 
Enter-Fil's actual inventory system.

CRITICAL CHANGE:
This inventory page tracks ONLY 3 critical raw materials.
Remove any reference to tracking ALL raw materials 
or auto-deducting per production step — 
Enter-Fil has no standard measurement per filter.
Staff manually monitors and records usage.

─── BARCODE SCANNER SECTION (clarified purpose) ───

Update the barcode scanner header text to:
"Scan finished goods barcode to view 
shipping details before dispatch"

Below the scanner input, add a small info note:
"ℹ Barcodes are assigned to finished goods only — 
not raw materials. Scan to verify order details, 
client info, and delivery address before shipping."

When a barcode is scanned, show a DISPATCH VERIFICATION CARD:
┌─────────────────────────────────────────────────┐
│ 📦 SCANNED: FP-2026-05236                       │
├─────────────────────────────────────────────────┤
│ JO: JO-008 · PO: PO-2026-0740                  │
│ Client: ARNEL                                   │
│ Item: Air Filter 115×220×500mm                  │
│ Quantity: 100 pcs                               │
│ Delivery Address: [client address]              │
│ Delivery Method: Company Vehicle                │
│ Contact Person: [client contact]                │
│ Phone: [client phone]                           │
├─────────────────────────────────────────────────┤
│ ✅ Verified — Ready for Dispatch                │
│ [📤 Mark as Dispatched] red button              │
└─────────────────────────────────────────────────┘

─── 4 KPI CARDS (updated) ───

Card 1: RAW MATERIALS
  Value: 139
  Subtext: "Filter Media · Adhesive · Box (manual count)"

Card 2: IN PRODUCTION
  Value: 0

Card 3: FINISHED GOODS
  Value: 107
  Subtext: "Barcode-tracked, ready to ship"

Card 4: LOW STOCK ALERTS
  Value: 2
  Red border + ALERT STATE badge (keep as is)

─── 3 ACTION BUTTONS (updated labels) ───

[↓ INBOUND] — receiving new raw materials or finished goods
[→ TRANSFER] — moving items between storage areas
[↑ DISPATCH] — releasing finished goods to logistics

─── CRITICAL RAW MATERIALS PANEL ───
(Replace "Job Order Material Checks" right panel 
with a dedicated raw materials tracker)

Title: "Critical Raw Materials"
Subtitle: "Manually updated stock levels — 
no auto-deduction (no standard measurement per filter)"

MATERIAL 1 — FILTER MEDIA (LOCAL)
┌─────────────────────────────────────────────────┐
│ 🧻 Filter Media (Local)                         │
│ Current Stock: [editable number] rolls          │
│ Low Stock Threshold: 4–5 rolls                  │
│ Status: ⚠️ LOW STOCK (amber) / ✅ OK (green)   │
│ Supplier Lead Time: Next day (local)            │
│ Last Updated: Apr 26, 2026 · by Tricia          │
│                                                 │
│ [📝 Update Count] button                        │
│ [📦 Order from Supplier] button (red if low)   │
│                                                 │
│ Note: "Imported filter media is purchased on   │
│ a fixed schedule regardless of stock level —   │
│ batched with other imports due to customs       │
│ lead time (months)."                            │
└─────────────────────────────────────────────────┘

MATERIAL 2 — ADHESIVE
┌─────────────────────────────────────────────────┐
│ 🔧 Adhesive                                     │
│ Current Stock: [editable number] sets           │
│ Low Stock Threshold: 3 sets                     │
│ Status: ✅ OK (green) / 🔴 LOW (red if < 3)    │
│ Supplier Lead Time: Next day (local)            │
│ Last Updated: Apr 26, 2026 · by Tricia          │
│                                                 │
│ [📝 Update Count] button                        │
│ [📦 Order from Supplier] button (red if low)   │
└─────────────────────────────────────────────────┘

MATERIAL 3 — CORRUGATED BOX
┌─────────────────────────────────────────────────┐
│ 📦 Corrugated Box                               │
│ Current Stock: [editable number] pcs            │
│ Low Stock Threshold: 50 pcs                     │
│ Status: ✅ OK (green) / 🔴 LOW (red if < 50)   │
│ Supplier Lead Time: ~2 weeks                    │
│ Last Updated: Apr 26, 2026 · by Tricia          │
│                                                 │
│ [📝 Update Count] button                        │
│ [📦 Order from Supplier] button (red if low)   │
└─────────────────────────────────────────────────┘

IMPORTED MATERIALS NOTE CARD (amber bg):
┌─────────────────────────────────────────────────┐
│ ⏰ Imported Filter Media — Batch Purchase       │
│ Imported rolls are purchased on a fixed         │
│ schedule regardless of current stock,           │
│ due to customs lead time (can take months).     │
│ Even if 1 roll is used, all imports are         │
│ purchased together in batches.                  │
│                                                 │
│ Next Scheduled Import: [editable date field]    │
│ [✏ Update Import Schedule]                      │
└─────────────────────────────────────────────────┘

─── UPDATE COUNT MODAL ───
When [📝 Update Count] is clicked:

Title: "Update Stock Count — Adhesive"
Current Count: 5 sets (shown, grayed)

New Count: [number input]
Reason for change: [dropdown]
  - Physical count / manual recount
  - New stock received from supplier
  - Used in production (manual deduction)
  - Correction / data error
  
Notes (optional): [text input]
[💾 Save Count] red button

Every update is logged with:
timestamp + user + old count + new count + reason
(visible in "Stock History" collapsible below each material card)

─── STOCK HISTORY (per material, collapsible) ───
"📋 Stock History" link below each material card:

Table: DATE · USER · OLD COUNT · NEW COUNT · REASON
Apr 26 · Tricia · 8 sets → 5 sets · Used in production
Apr 20 · Tricia · 3 sets → 8 sets · New stock received
Apr 15 · Tricia · 6 sets → 3 sets · Used in production

─── RECENT SCANS (left panel — keep as is) ───
Keep the Recent Scans list but update label to:
"Recent Barcode Scans (Finished Goods)"