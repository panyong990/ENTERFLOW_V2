# Tab 2 fixes + Tab 3 redesign + Quotation Preview

## Plan

### Batch A — orders store extensions
- [x] Add `QuotationDoc` interface (line items, note + highlight, packaging, shipping, terms, validity, sent metadata)
- [x] Add `quotationDoc?: QuotationDoc` field to Inquiry
- [x] Add `setQuotationDoc(id, doc)` action
- [x] Auto-generate quotation number `Q-{YEAR}-{nnn}`

### Batch B — Tab 2 fixes (`CostEstimationPanel.tsx`)
- [x] Remove "Auto-fill from formula" button from header
- [x] Replace with ⓘ tooltip per BOM line showing reference values
- [x] Remove Packaging from `ADD FILTER PART` chip list (also move it out of `partCategoryMeta` for chips, but keep it as a category for Inventory)
- [x] Filter chips to show only unselected categories
- [x] When all standard categories added, hide chips and show "+ Add Custom Part" text input only
- [x] Cost Estimation Setup panel — dark navy header (already has it but verify color)
- [x] Summary box layout: Material / Total Cost with markup / WITH VAT (large red highlighted) / × qty pcs = Order Total (navy bar)
- [x] Two action buttons (Save Template = outlined green, Apply = solid red)

### Batch C — Tab 3 redesign (new `QuotationBuilder.tsx`)
- [x] Section A: locked manufacturing unit cost summary card with `← back to Tab 2` link
- [x] Section B: Quotation builder
  - [x] Editable line items table (NO/QTY/UNIT/DESCRIPTION/UNIT PRICE/TOTAL)
  - [x] Auto-populate first row from inquiry + Tab 2 result
  - [x] Description supports filter name + sub-line for size (e.g. "FILTER BAG" / "SIZE : 135mm × 99 INCHES")
  - [x] NOTE field with yellow highlight toggle + 4 preset chips
  - [x] Add Packaging dropdown (from inventory) + qty + include-in-unit toggle
  - [x] Add Shipping freeform label + amount + include-in-unit toggle
  - [x] TOTALS block right-aligned with VAT label (Exclusive/Inclusive/Zero-Rated from Tab 2)
  - [x] Terms & Conditions: 4 fields (terms of payment dropdown, time of delivery, place of delivery, validity date)
- [x] Section C: Preview button (outlined navy) + Send to Client (solid red)

### Batch D — `QuotationPreviewModal.tsx` (new file)
- [x] Enter-Fil letterhead (logo, address, phone, email, "QUOTATION" title)
- [x] Quotation No. / Date / Valid Until
- [x] Client block (Attention / Company / Address)
- [x] Line items table
- [x] Yellow note row if highlighted
- [x] Two-column footer: Terms (left) / TOTAL + VAT label (right)
- [x] Prepared by / Approved by signatures
- [x] Print/Download PDF button (browser print)

### Batch E — Wire into SalesOrders
- [x] Replace existing Tab 3 (legacy quote block) with `QuotationBuilder`
- [x] Send to Client wires through `setQuotationDoc` + existing `sendQuotation` + notification + status to "Quotation Sent"
- [x] Inquiry's `quotationDoc` persists so re-opening shows the saved values

### Batch F — Build verification
- [x] `npm run build` clean
- [x] No leftover references to auto-fill
- [x] Packaging not in chips; tooltip works
- [x] Preview modal renders correctly
