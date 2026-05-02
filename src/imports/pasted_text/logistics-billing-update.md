Update Logistics & Billing page (Management) 
and Client Portal Logistics tab.

When clicking any delivery row, expand a 
DETAIL PANEL below that row showing 
context-specific contact and logistics info.

─── DELIVERY METHOD: COMPANY VEHICLE ───

Expanded detail for Company Vehicle rows:

┌─────────────────────────────────────────────────┐
│ DELIVERY DETAILS · PO-2026-9901                 │
├───────────────────┬─────────────────────────────┤
│ ENTER-FIL DRIVER  │ CLIENT RECIPIENT             │
│ (Company Vehicle) │                             │
├───────────────────┼─────────────────────────────┤
│ Driver: [editable │ Recipient: M. Rivera         │
│ text field]       │ Company: B.E. Aerospace      │
│                   │ Phone: +63 917 XXX XXXX      │
│ Vehicle Plate:    │ Email: mrivera@be.com        │
│ [editable field]  │ Delivery Address:            │
│                   │ [full address, editable]     │
│ Contact:          │                             │
│ [Enter-Fil phone] │                             │
├───────────────────┴─────────────────────────────┤
│ Enter-Fil Office Contact:                       │
│ 📞 Enter-Fil: +63 2 XXX XXXX                    │
│ 📍 Enter-Fil Address:                           │
│    [company address from settings]              │
├─────────────────────────────────────────────────┤
│ DELIVERY STATUS:                                │
│ [Pending ▼] [In Transit ▼] [Delivered ▼]        │
│ dropdown to update status                       │
│                                                 │
│ Estimated Delivery Date: [date picker]          │
│ Actual Delivery Date: [date picker]             │
├─────────────────────────────────────────────────┤
│ SIGNED DR:                                      │
│ [📷 Upload Signed DR] dropzone                  │
│ (shows thumbnail if already uploaded)           │
│ Note: "Upload photo of signed Delivery Receipt" │
├─────────────────────────────────────────────────┤
│ [💾 Save Changes]  [📤 Notify Client]           │
└─────────────────────────────────────────────────┘

─── DELIVERY METHOD: CLIENT PICK-UP ───

┌─────────────────────────────────────────────────┐
│ PICK-UP DETAILS · PO-2026-9533                  │
├───────────────────┬─────────────────────────────┤
│ ENTER-FIL         │ CLIENT PICK-UP PERSON        │
│ PICK-UP LOCATION  │                             │
├───────────────────┼─────────────────────────────┤
│ Address:          │ Pick-up Person: [editable]  │
│ [Enter-Fil full   │ Company: Maynilad            │
│ address]          │ Phone: +63 917 XXX XXXX      │
│                   │ Email: [editable]            │
│ Contact Person:   │                             │
│ [editable — who   │ Expected Pick-up Date:      │
│ to call on        │ [date picker]               │
│ arrival]          │                             │
│                   │ Vehicle Plate (if known):   │
│ Office Hours:     │ [editable optional]         │
│ Mon–Sat 8AM–5PM   │                             │
│                   │ ID Required: ☑ Yes          │
│ 📞 Office:        │ "Present valid ID on        │
│ +63 2 XXX XXXX    │ pick-up"                    │
├───────────────────┴─────────────────────────────┤
│ ENTER-FIL COMPANY INFO (shown to client):       │
│ Enter-Fil Industrial Products                   │
│ 📍 [Company Address]                            │
│ 📞 +63 2 XXX XXXX                               │
│ 🕐 Mon–Sat, 8:00 AM – 5:00 PM                  │
├─────────────────────────────────────────────────┤
│ STATUS UPDATE:                                  │
│ [⬜ Awaiting Pick-up] [✅ Picked Up]             │
│                                                 │
│ Signed Pick-up Receipt:                         │
│ [📷 Upload] (client signs on pick-up)           │
├─────────────────────────────────────────────────┤
│ [💾 Save Changes]  [📤 Notify Client]           │
└─────────────────────────────────────────────────┘

─── DELIVERY METHOD: LALAMOVE ───

┌─────────────────────────────────────────────────┐
│ LALAMOVE DELIVERY · PO-2026-9531                │
├─────────────────────────────────────────────────┤
│ ⚠️ Lalamove is managed outside Enter-Flow.      │
│ Book via the Lalamove app separately.           │
├───────────────────┬─────────────────────────────┤
│ SENDER INFO       │ RECIPIENT INFO              │
│ (Enter-Fil)       │ (Client)                    │
├───────────────────┼─────────────────────────────┤
│ Name: Enter-Fil   │ Name: M. Rivera             │
│ Industrial Prod.  │ Company: B.E. Aerospace     │
│ Address:          │ Phone: +63 917 XXX XXXX     │
│ [company address] │ Delivery Address:           │
│ Contact:          │ [full address, editable]    │
│ +63 2 XXX XXXX    │                             │
├───────────────────┴─────────────────────────────┤
│ Lalamove Tracking No.: [editable text field]    │
│ "Paste tracking number from Lalamove app here"  │
│                                                 │
│ Lalamove Booking Ref.: [editable]              │
│                                                 │
│ [📋 Copy Sender Address] button                 │
│ [📋 Copy Recipient Address] button              │
│ "Copy to paste into Lalamove app quickly"       │
├─────────────────────────────────────────────────┤
│ STATUS:                                         │
│ [Booked] [In Transit] [Delivered] toggle        │
│                                                 │
│ Signed DR / Proof of Delivery:                  │
│ [📷 Upload photo from Lalamove]                 │
├─────────────────────────────────────────────────┤
│ [💾 Save Changes]  [📤 Notify Client]           │
└─────────────────────────────────────────────────┘

─── CLIENT PORTAL — LOGISTICS TAB UPDATE ───

When client clicks any delivery row, show 
a simplified version of the same panel:

FOR COMPANY VEHICLE delivery:
  Enter-Fil Driver: [name if available, else "Our team"]
  Enter-Fil Contact: +63 2 XXX XXXX
  Your Recipient: M. Rivera
  Delivery Address: [their address on file]
  Estimated Delivery: Apr 2, 2026
  Status: [Delivered ✅]
  Signed DR: [View Photo] if uploaded

FOR CLIENT PICK-UP:
  Pick-up Location:
  📍 Enter-Fil Industrial Products
     [Full company address]
  📞 +63 2 XXX XXXX
  🕐 Mon–Sat, 8:00 AM – 5:00 PM
  
  Your Pick-up Details:
  Expected Date: [date]
  Pick-up Person: [name entered by management]
  Note: "Please bring a valid ID upon pick-up."
  
  [🗺 Get Directions] link (opens Google Maps)

FOR LALAMOVE:
  Delivery via: Lalamove
  Tracking No.: [number if entered by management]
  [🔗 Track on Lalamove App] link (if tracking no. exists)
  Note: "For real-time tracking, 
  use the Lalamove app with the tracking number above."
  
  Enter-Fil Contact (if you have questions):
  📞 +63 2 XXX XXXX