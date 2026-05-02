Update Client Management page — all three tabs in the 
client side panel (Overview, Transactions, Job Orders).

═══ TAB 1: OVERVIEW ═══

When clicking a client row, side panel opens showing:

CLIENT HEADER:
  [BA] avatar circle (initials, colored)
  B.E. Aerospace (bold, large)
  Aerospace · Client since Mar 2023
  
  Contact block:
  👤 Contact Person: M. Rivera
  📞 Phone: +63 917 XXX XXXX (editable)
  📧 Email: mrivera@beaerospace.com (editable)
  📍 Address: [full address field] (editable)
  🏢 Industry: Aerospace
  
  Quick stats row:
  Total Orders: 3 · Total Spent: ₱0 · Last Order: Mar 31, 2026
  
  Client notes textarea:
  "Internal notes about this client — 
  preferred payment terms, special requirements, etc."
  [✏ Edit Notes] link
  
  [✏ Edit Client Info] button (outlined)
  [+ NEW INQUIRY FOR THIS CLIENT] red button
  — clicking this pre-fills the Sales & Orders 
  new inquiry modal with this client's name 
  and payment terms already filled in

═══ TAB 2: TRANSACTIONS ═══

Table: DATE · PO · ITEM · AMOUNT · STATUS

Clicking any row expands a FULL TRANSACTION DETAIL 
panel below that row (accordion style):

EXPANDED TRANSACTION — PO-2026-9901:

┌─────────────────────────────────────────────────┐
│ TRANSACTION DETAIL                              │
│ PO-2026-9901 · Mar 31, 2026 · Paid ✅           │
├─────────────────────────────────────────────────┤
│ PRODUCT ORDERED:                                │
│ Air Filter 115×103×500mm                        │
│ OD: 115mm · ID: 103mm · Height: 500mm           │
│ Filter Media: Microglass Fiber                  │
│ Inner Core: Expanded Metal Perfo 2mm            │
│ End Cap: E.G. 1.0mm                             │
│ Quantity: 50 pcs                                │
│ Unit Price: ₱1,500 · Total: ₱75,000            │
├─────────────────────────────────────────────────┤
│ DOCUMENTS:                                      │
│ 📄 QT-2026-9901.pdf [View]                      │
│ 📄 PO-2026-9901.pdf [View]                      │
│ 📄 JO-007.pdf [View]                            │
│ 📄 SI-2026-9901.pdf [View]                      │
│ 📄 DR-signed.jpg [View]                         │
├─────────────────────────────────────────────────┤
│ PAYMENT:                                        │
│ Type: 30-Day Terms                              │
│ Due Date: Apr 30, 2026                          │
│ Status: Paid ✅ · Cleared by: Tricia            │
├─────────────────────────────────────────────────┤
│ DELIVERY:                                       │
│ Method: Company Vehicle                         │
│ Delivered: Apr 2, 2026                          │
│ Signed DR: [View Photo]                         │
├─────────────────────────────────────────────────┤
│                                                 │
│ 🔁 [REORDER THIS — Pre-fill New Inquiry] button │
│    (amber/gold bg, dark text, full width)       │
│    "Creates a new inquiry with the same         │
│    product specs pre-filled. You can edit       │
│    before submitting."                          │
└─────────────────────────────────────────────────┘

REORDER BEHAVIOR:
When "Reorder This" is clicked:
1. Opens the New Inquiry modal in Sales & Orders
2. Pre-fills ALL fields:
   - Client Name: B.E. Aerospace (locked, gray bg)
   - Filter Type: Air Filter
   - OD1: 115 · OD2: 103 · Height: 500
   - Filter Media: Microglass Fiber
   - Inner Core: Expanded Metal Perfo 2mm
   - End Cap: E.G. 1.0mm
   - Quantity: 50 (editable — client may want different qty)
   - Payment Type: 30-Day Terms (pre-selected)
3. All fields remain editable
4. Banner at top of modal (amber):
   "🔁 Reorder based on PO-2026-9901 · Mar 31, 2026
   Review and edit specs before submitting."
5. Submit button: [📋 SAVE & SEND QUOTATION]

═══ TAB 3: JOB ORDERS ═══

List of all JOs linked to this client.
Clicking any JO row expands FULL JO DETAIL:

EXPANDED JO — JO-2026-001:

┌─────────────────────────────────────────────────┐
│ JOB ORDER DETAIL                                │
│ JO-2026-001 · B.E. Aerospace · Active 🔵        │
├─────────────────────────────────────────────────┤
│ PRODUCT SPECIFICATIONS:                         │
│ Item Code: KF-OS.107.65.252                     │
│ Item Name: Air Filter 115×103×500mm             │
│ OD1: 115mm · OD2: 103mm                         │
│ ID1: 64.6mm · Height: 500mm                     │
│ Filter Media: Microglass Fiber / Inside         │
│ Inner Core: Expanded Metal Perfo 2mm            │
│ End Cap: E.G. 1.0mm                             │
│ O-Ring: — · Gasket: —                           │
│ OEM PN: — · Brand: Hitachi Comp.                │
│ Quantity: 50 pcs                                │
├─────────────────────────────────────────────────┤
│ PRODUCTION STATUS:                              │
│ Current Stage: Quality / Product Inspection     │
│ Stage: 9 of 10                                  │
│ Progress: ▓▓▓▓▓▓▓▓▓░ 90%                       │
│ Due: Apr 30, 2026                               │
├─────────────────────────────────────────────────┤
│ LINKED DOCUMENTS:                               │
│ 📄 JO-2026-001.pdf [View] [Download]            │
│ 📄 PO-2026-9901.pdf [View]                      │
│ 📄 SI-2026-9901.pdf [View]                      │
├─────────────────────────────────────────────────┤
│                                                 │
│ 🔁 [REORDER THIS — Pre-fill New Inquiry] button │
└─────────────────────────────────────────────────┘

Also add at the top of Tab 3:
"💡 Tip: Click any job order to view full specs 
and reorder with one click."

═══ CLIENT PORTAL SIDE — REORDER FROM HISTORY ═══

In Client Portal → Orders tab, below the active 
orders table, add:

"📋 ORDER HISTORY" collapsible section:
Subtext: "Completed and paid orders. Click any to reorder."

Table: DATE · ITEM · QTY · TOTAL · ACTION
Row: Mar 31, 2026 · Air Filter 115×103×500mm · 
     50 pcs · ₱75,000 · [🔁 Reorder] button (outlined red)

Clicking [Reorder] on client portal:
1. Opens the New Inquiry form
2. Pre-fills all product specs from that order
3. Client only needs to change qty if needed
4. Banner: "🔁 Reordering based on your 
   Mar 31, 2026 order — edit as needed"
5. Submit → goes to management as new INQ