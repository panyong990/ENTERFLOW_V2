Fix the following across 3 pages:

CLIENT MANAGEMENT:
1. Clicking any row OR "View Details" opens a 
   full right-side panel (580px) with 3 tabs:
   
   OVERVIEW TAB:
   - Company name, industry, contact person,
     phone, email, full address (all editable)
   - Quick stats: Total Orders, Last Order date,
     Preferred Payment Terms
   - Internal Notes textarea
   - [+ New Inquiry for This Client] red button
   
   TRANSACTIONS TAB:
   - Table: Date · PO · Item · Amount · Status
   - Clicking a row expands full detail:
     product specs, all linked documents 
     (QT/PO/JO/SI/DR), payment info, delivery info
   - [🔁 Reorder This] gold button in each row
   - Reorder pre-fills new inquiry form with 
     all specs from that transaction
   
   JOB ORDERS TAB:
   - Each JO row expands to show:
     Full filter specs (OD, ID, Height, Media,
     Inner Core, End Cap, OEM PN, Brand, Qty)
     Current production stage + progress bar
     Linked documents with [View] buttons
   - [🔁 Reorder This] gold button per JO

2. "+ Add Client" button opens a MODAL with fields:
   Company Name · Industry · Contact Person ·
   Phone · Email · Address · Payment Terms ·
   Notes (optional)
   [💾 Save Client] red button
   [Cancel] ghost button

USER MANAGEMENT:
3. Remove "create your own account" flow entirely.
   Management creates all accounts.
   
   Add [+ Add User] red button top-right of page.
   Opens modal:
   Full Name · Email · 
   Temporary Password (auto-generated, shown once)
   Role: [No Role] [Management] 
         [Accounting/Finance] [Floor/Production]
   [✉ Create Account & Send Invite] red button
   
   Note below button: 
   "User will receive an email with their 
   temporary password and login instructions."
   
   Edit Role modal (when Edit Role clicked):
   Shows current role · 4 role radio options ·
   [Save Changes] · [Cancel]

LOGIN:
4. Create TWO separate login pages:

   PAGE 1 — Enter-Flow Staff Login (/login)
   URL/tab indicator: "Enter-Flow ERP"
   Logo: ▲ ENTER-FLOW (navy bg)
   Fields: Email · Password
   Button: [→ Sign In] red
   Small link at bottom: 
   "Client? Access your portal →" 
   (links to /client-login)

   PAGE 2 — Client Portal Login (/client-login)  
   URL/tab indicator: "Enter-Fil Client Portal"
   Logo: ▲ ENTER-FIL Industrial Products (white bg)
   Fields: Email · Password
   Button: [→ Access Portal] red
   Small link at bottom:
   "Enter-Fil staff? Sign in here →"
   (links to /login)
   
   Both pages: "Forgot password?" link below button.
   Separate visual identity — staff = dark navy header,
   client = clean white card on light gray bg.

Fix the following in the Client Portal:

1. ADD SETTINGS TAB to client portal.
   Add ⚙ Settings as a 5th item in the portal 
   tab bar: Orders · Status · Logistics · 
   Accounting · ⚙ Settings

   Settings page content:
   Title: "Company Settings"
   
   COMPANY INFORMATION (editable):
   Company Name: [text input]
   Industry: [text input]
   Address Line 1: [text input]
   Address Line 2: [text input]
   City / Province: [text input]
   ZIP Code: [text input]
   
   CONTACT PERSON (editable):
   Full Name: [text input]
   Phone: [text input]
   Email: [text input - grayed, cannot change email 
   (contact admin to change login email)]
   
   DELIVERY PREFERENCES:
   Preferred Delivery Method: 
   [Company Vehicle] [Lalamove] [Client Pick-up]
   radio options
   
   Pick-up Person (if pick-up preferred):
   Name: [text input]
   Phone: [text input]
   
   [💾 Save Settings] red full-width button

2. LOGISTICS TAB — clicking any row expands detail:

   FOR COMPANY VEHICLE:
   Shows: Enter-Fil contact number, driver name 
   (if available), estimated delivery date,
   signed DR photo (View Photo button if uploaded)
   
   FOR LALAMOVE:
   Shows: Tracking number (if entered by management),
   [🔗 Track on Lalamove] button (opens Lalamove),
   Enter-Fil contact: +63 2 XXX XXXX
   Note: "For live tracking, use the Lalamove app."
   
   FOR CLIENT PICK-UP:
   Shows full Enter-Fil address block:
   📍 Enter-Fil Industrial Products
   [company address from settings]
   📞 [company phone]
   🕐 Mon–Sat, 8:00 AM – 5:00 PM
   [🗺 Get Directions] link → Google Maps
   Note: "Please bring valid ID upon pick-up."

Fix the following on the Production Floor page:

1. Each JO card header: add [📄 View JO File] 
   button next to "View Full Details" link.
   Clicking opens the JO document in a 
   preview modal (PDF viewer overlay).
   Shows the formal JO template with all specs,
   PO reference, client info, quantity.

2. REPLACE the dropdown stage expander with 
   a [📋 View Production Stages →] button.
   Clicking this button navigates to a 
   DEDICATED STAGE MONITORING PAGE for that JO:
   
   URL: /production/JO-2026-001
   Page title: JO-2026-001 · B.E. Aerospace
   Back button: [← Back to Production Floor]
   
   Full-page vertical timeline of all 10 stages:
   Each stage row shows:
   - Stage number + name
   - Status: ✅ Done (green) / 🔵 Current (blue) 
     / ⬜ Pending (gray) / ⚠️ Reverted (amber)
   - Date completed (if done)
   - Who marked it (name)
   - [✏ Edit/Revert] button on each completed stage
   
   Bottom of page:
   [✅ MARK CURRENT STAGE DONE] red large button
   [⚠️ REPORT MATERIAL SHORTAGE] outlined button

3. STAGE REVERT / EDIT functionality:
   Clicking [✏ Edit/Revert] on any stage opens modal:
   
   Title: "Update Stage — Assembling"
   
   "Change status to:"
   [✅ Completed] [🔵 Set as Current] [⬜ Pending]
   
   Reason (required): [text input]
   Examples shown: "Failed quality check", 
   "Human error — needs redo", 
   "Client requested spec change"
   
   ⚠️ Warning banner (amber):
   "Reverting a stage will update the 
   production timeline and notify management."
   
   [Save Stage Update] red · [Cancel] ghost
   
   After saving: stage updates on timeline,
   activity log entry created with timestamp,
   user name, old status, new status, reason.

Fix the following in Sales & Orders:

1. PO DOCUMENT VIEWER before generating JO:
   In the Generate JO modal, the uploaded PO 
   currently shows filename only.
   
   Replace with a proper document preview:
   - If PDF: show embedded PDF viewer (iframe)
     inside the modal, scrollable, full content visible
   - If image (JPG/PNG): show full image preview
     inside modal, zoomable
   - [🔍 Open in Full Screen] button top-right 
     of preview area
   - [🔄 Replace Document] small link below preview
   
   Management must be able to READ the full PO 
   before clicking Generate JO.

2. JO TEMPLATE VISIBLE TO CLIENT after generation:
   When JO is generated, client portal Status tab
   shows a [📄 View Job Order] button.
   
   Clicking opens a FORMATTED JO TEMPLATE modal
   matching Enter-Fil's physical JO format:
   
   ┌──────────────────────────────────────────┐
   │ ▲ ENTER-FIL INDUSTRIAL PRODUCTS         │
   │ ITEM NAME: AIR/OIL SEPARATOR FILTER     │
   │ ITEM CODE: OILSEP-00001                 │
   │ ENTER-FIL PN: KF-OS.107.65.252          │
   │ DATE: Apr 26, 2026                      │
   │ COMPANY NAME: B.E. AEROSPACE            │
   │ QUANTITY: 50                            │
   ├──────────────────────────────────────────┤
   │ TECHNICAL SPECIFICATION                 │
   │ DIMENSION:                              │
   │   OD 1: 115mm · OD 2: 103mm            │
   │   ID 1: 64.6mm · ID 2: —               │
   │   HEIGHT: 500mm                         │
   │ END CAP: E.G. (1.0mm)                   │
   │ FILTER MEDIA: Microglass Fiber / Inside │
   │ INNER CORE: Expanded Metal Perfo 2mm    │
   │ OUTER CORE: —                           │
   │ O-RING: — · GASKET: —                  │
   │ OEM PN: — · BRAND: Hitachi Comp.       │
   ├──────────────────────────────────────────┤
   │ PREPARED BY: Tricia (Management)        │
   │ APPROVED BY: ___________                │
   └──────────────────────────────────────────┘
   
   [📥 Download JO PDF] button
   [✕ Close] button
   
   This same JO template is also accessible 
   from the Production Floor card via 
   [📄 View JO File] button (fix #1 above).