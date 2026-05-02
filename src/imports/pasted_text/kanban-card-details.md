Update ALL card types in Sales & Orders kanban:
NEW INQUIRY · QUOTATION SENT · PO RECEIVED cards

When any card is clicked anywhere (not just buttons),
open a FULL DETAIL SIDE PANEL (not a modal — 
slide in from the RIGHT side, 520px wide, 
the kanban board dims behind it).

SIDE PANEL STRUCTURE:

─── PANEL HEADER ───
Left: INQ-005 (JetBrains Mono, large) · [Status badge]
Right: [✏ Edit] button · [⋯ More options] dropdown · [✕ Close]

"More options" dropdown items:
  - Duplicate Inquiry
  - Cancel Inquiry (with confirmation)
  - Download as PDF
  - View Activity Log

─── TAB BAR (inside panel) ───
[📋 Inquiry Details] [📄 Quotation] [📦 Purchase Order] [📁 Documents]
Show tab content below. Each tab is independent.

═══ TAB 1: INQUIRY DETAILS ═══

Client block:
  Company: ARNEL (bold)
  Contact: —
  Payment Type: [Terms] badge
  Rush Order: No
  Created: Apr 20, 2026 · By: Tricia (Management)

Product lines (each expandable):

Product #1 — Air Filter
  OD1: 115mm · OD2: 220mm
  ID1: — · ID2: —
  Height: 500mm
  Filter Media: Microglass Fiber
  Inner Core: Expanded Metal Perfo 2mm
  Outer Core: —
  O-Ring: — · Gasket: —
  OEM Part No.: —
  Quantity: 100 pcs

[+ Add Product Line] link button
[✏ Edit Inquiry Details] button (opens same fields editable)

Internal Notes:
  (notes text or empty state)

─── EDIT MODE (when ✏ Edit clicked) ───
All fields become editable inline.
Each field has a small pencil icon on hover.
Save changes with [💾 Save Changes] button.
Cancel with [✕ Discard] link.

═══ TAB 2: QUOTATION ═══
(This tab is the MAIN area for viewing, 
editing, and sending quotations)

STATE A — No quotation yet:
  Empty state illustration
  "No quotation has been created yet."
  [📋 CREATE QUOTATION] red button (opens quotation editor below)

STATE B — Quotation Draft (not sent yet):
  [Draft] gray badge · Last edited: Apr 26, 2026

  QUOTATION EDITOR (inline, editable):
  
  Quotation No.: QT-2026-005 (auto-generated)
  Valid Until: [date picker]
  Lead Time: [__] days from PO receipt
  
  Per-product cost table (editable):
  ┌──────────────────┬─────┬──────────┬────────┬────────┬──────────┐
  │ Product          │ Qty │ Raw Mats │ Labor  │ Markup │ Unit Price│
  │                  │     │    (₱)   │  (₱)  │  (%)  │    (₱)   │
  ├──────────────────┼─────┼──────────┼────────┼────────┼──────────┤
  │ Air Filter       │ 100 │[_______] │[______]│  30%  │  ₱1,500  │
  │ 115×220×500mm    │     │          │        │[edit] │(computed)│
  └──────────────────┴─────┴──────────┴────────┴────────┴──────────┘
  [+ Add product row if needed]
  
  TOTAL: ₱150,000 (auto-calculated, bold, right-aligned)
  
  Inventory check (auto-run):
  ✅ Filter Media: Sufficient (12 rolls available)
  ⚠️ Adhesive: LOW — only 2 sets left
  Note: "Low stock detected. Consider adjusting 
  lead time before sending quotation."
  Adjusted Lead Time suggestion: +7 days
  
  Payment terms summary:
  [COD — collect downpayment first]
  [15-Day Terms — invoice after delivery]
  [30-Day Terms — invoice after delivery]
  (shows whichever was selected in inquiry)
  
  Client-facing preview note:
  "The client will see: product list, unit prices, 
  total, lead time, and payment terms. 
  Raw material costs and markup are hidden from client."
  
  BOTTOM ACTIONS:
  [💾 Save Draft] ghost · 
  [👁 Preview Client View] outlined · 
  [📤 SEND QUOTATION TO CLIENT] red button

STATE C — Quotation Sent:
  [Sent ✅] green badge · Sent: Apr 22, 2026 · To: ARNEL
  
  Shows read-only view of sent quotation.
  
  [✏ Edit & Resend] button — opens editor again
  Note: "Editing will notify the client 
  that a revised quotation has been sent."
  
  CLIENT VIEW PREVIEW (collapsible section):
  Shows exactly what the client sees in their portal:
  ┌──────────────────────────────────────────────┐
  │ 📄 Quotation from Enter-Fil Industrial       │
  │ QT-2026-005 · Valid until: May 6, 2026       │
  │                                              │
  │ Product           Qty    Unit Price  Total   │
  │ Air Filter        100    ₱1,500      ₱150,000│
  │ 115×220×500mm                                │
  │                                              │
  │ ORDER TOTAL:              ₱150,000           │
  │ Lead Time: 14 days from PO receipt           │
  │ Payment: 30-Day Terms                        │
  │                                              │
  │ [✅ Approve & Upload PO] [✏ Request Revision]│
  └──────────────────────────────────────────────┘

═══ TAB 3: PURCHASE ORDER ═══

STATE A — Awaiting PO:
  "Waiting for client to upload their Purchase Order."
  [📎 Upload PO on behalf of client] outlined button
  (for walk-in or phone-in clients who can't use portal)
  
  OR client uploaded via portal — shows:
  
STATE B — PO Received (VERIFY BEFORE CONVERTING):
  [PO Received ✅] green badge · Uploaded: Apr 24, 2026

  PO VERIFICATION CHECKLIST:
  Management must verify these before generating JO:
  
  □ Client name matches inquiry: ARNEL ✅
  □ Product specs match quotation ✅
  □ Quantity matches: 100 pcs ✅
  □ PO Number noted: PO-2026-0740 ✅
  □ Payment terms confirmed: 30-Day Terms ✅
  □ Downpayment collected (if COD): N/A ✅
  
  Editable PO details:
  PO Number: [PO-2026-0740] (editable field)
  PO Date: [Apr 24, 2026] date picker
  PO Amount: [₱150,000] editable
  Notes: textarea
  
  Uploaded PO file:
  📄 PO-ARNEL-0740.pdf · [👁 View] [🔄 Replace]
  
  CRITICAL: Two-step conversion warning:
  ┌─────────────────────────────────────────────┐
  │ ⚠️ Review all details before generating JO  │
  │ Once a JO is generated, it is sent to the  │
  │ Production Floor and cannot be undone.      │
  │                                             │
  │ [✏ Edit PO Details] [🏭 GENERATE JOB ORDER] │
  │                      (red button)           │
  └─────────────────────────────────────────────┘

═══ TAB 4: DOCUMENTS ═══

All uploaded files in one place:
  
  📁 ATTACHED FILES
  
  Inquiry Documents:
  (empty or list of uploads from inquiry creation)
  
  Quotation:
  📄 QT-2026-005.pdf · Apr 22, 2026 · [👁 View] [⬇ Download]
  
  Purchase Order:
  📄 PO-ARNEL-0740.pdf · Apr 24, 2026 · [👁 View] [⬇ Download]
  
  Job Order (generated):
  📄 JO-008.pdf · Apr 25, 2026 · [👁 View] [⬇ Download]
  
  Other Uploads:
  [📎 Upload any document] dropzone
  
  SEND TO CLIENT button per document:
  Each document row has [📤 Send to Client] 
  link — client sees it in their portal Documents tab.