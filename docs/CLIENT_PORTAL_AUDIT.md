# Client Portal lightweight audit

Date: 2026-11-15. Static inspection only; no tests, servers, database queries, or application changes. Implementation findings describe source code, not verified runtime/deployment behavior.

## Architecture and implementation status

| Area | Existing implementation | Status / gap |
| --- | --- | --- |
| Entry and routing | `src/app/App.tsx` keeps `{role, name}` in React state and renders `ClientPortal` for the client role. Portal tabs are Orders, Status, Logistics, Accounting, and Settings. | Local conditional rendering; no URL routing, deep links, or server-session restoration. Refresh loses the login state. |
| Client dashboard | `ClientPortal.tsx` contains the shell, order cards/search/status filters, production timeline, logistics, accounting, and settings. Orders is the landing tab. | Functional local workspace; no separate client dashboard/overview page or dashboard API. Staff `Dashboard.tsx` is not the client landing page. |
| Orders | New inquiries, multi-product orders, reorders, quotation previews/revision requests, PO uploads, cancellation requests, and invoice links use `useOrders()`. | Browser-only workflow backed by shared order state and local storage, initially populated with demo orders. No server submission or cross-device synchronization. |
| Status / documents | Pipeline cards and JO, quotation, and invoice modals use inquiry data. | JO viewer uses a single boolean and selects the first inquiry with a JO, rather than the clicked order; includes `DEMO_JO_DATA` fallback. Document previews are not server-authorized document retrieval. |
| Logistics | Delivery status/filtering, tracking links, receipt preview/print, and pending/signed DR upload and submission. | Local store transitions and browser attachments; no delivery or upload API. |
| Accounting | Sent invoices, payment history, amount/allowance checks, receipt upload, and pending verification state. | Local payment records; no backend payment submission/verification integration. |
| Company profile | `SettingsTab` saves company name, industry, and address through `clientCompanySettings.ts`, keyed by normalized original client name. | Local storage only. Contact/phone, delivery/pickup choices, and notification preferences are component state and omitted from save. Defaults include hardcoded contact/email/industry. Company-name edits do not change login/order identity. |
| Authentication | `Login.tsx` verifies browser accounts; registration saves browser applications. Demo quick-login calls `onLogin` without password verification. | Not connected to backend authentication or approval; logout only clears frontend state. Forgot-password button has no handler. Settings password change validates fields and displays success without changing a password or checking the existing one. |
| Notifications | `NotificationBell`, `notifications.tsx`, and order events provide local notifications. | Local storage; email dispatch is explicitly simulated. Profile preferences do not configure real delivery. |

## Order Wizard and filter specifications

`NewOrderWizardModal`, `FilterTypeSelector`, `DynamicDimensionFields`, and `ProductCard` are embedded in `ClientPortal.tsx`. Five steps cover filter type/name, dimensions/material, filtration rating, add-ons, and review. Supports multiple filters, reorder copies, per-product sketches, contact person, notes, and 15/30-day terms. Submission calls `addInquiry` or `addInquiryWithProductSketches` and creates local staff notifications.

`store/filterTemplates.ts` supplies 16 filter types across six groups: cylindrical, flat panel, pocket bag, HEPA, bag collector, and pad/disc. Group templates drive dimensions and parts metadata; unknown legacy codes fall back to cylindrical. This is a TypeScript catalogue, not a backend specification service.

Validation is partial: step checks require a three-character name, the first dimension being nonempty, media, a rating, and integer quantity >=10. Final submission checks contact and quantities but does not comprehensively revalidate every product specification. Positive numeric dimensions, type/group consistency, and attachment content/size need server validation. File-picker extensions alone are insufficient. Attachments use IndexedDB (`enterflow.attachments.v1`, `files`) and data URLs; the two portal `fetch` calls retrieve stored sketch data URLs, not backend endpoints.

## Backend APIs available for reuse

`backend/src/app.js` mounts only health, authentication, and client-application review routes. No frontend `/api/` calls were found; `vite.config.ts` has no API proxy. Same-origin deployment/proxy configuration must be established when connecting the UI.

| API | Reuse and limitations |
| --- | --- |
| `POST /api/auth/register` | Server validation, password hashing, duplicate checks, and pending application persistence; replace browser registration. |
| `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` | Real cookie sessions and identity; replace local account verification/login state. Login and `/me` currently omit `clientId` and company profile, although auth middleware has `request.auth.clientId`. Backend display name represents the contact, so it must not replace the current company-name lookup directly. |
| `GET /api/client-applications`, `GET /api/client-applications/:id`, `POST /:id/approve`, `POST /:id/reject` under that prefix | Admin-only onboarding APIs with authentication, role/permission checks, transactional decisions, and auditing. Reuse for staff approval, not client portal data access. |

No mounted APIs were found for company profile/password updates, filter catalogue, inquiries/orders, quotations/POs, client invoices/payments, delivery receipts, attachments, or client notifications.

## Database tables referenced by inspected code

Frontend portal code accesses no SQL tables. Relevant backend services reference:

- `users`: credentials, active status, role/account type, and `client_id` association.
- `user_sessions`: session creation, validation, activity, and revocation.
- `client_applications`: registration and approval/rejection state.
- `clients`: company duplicate checks and company creation during approval.
- `audit_events`: application decision audit trail.

These references come from auth, session, registration, and client-application services. Business tables were not inferred from frontend type names; schema suitability for future portal APIs was not audited.

## Security and company isolation

- **Critical before production:** browser-editable accounts/roles and passwordless demo login govern UI access. All companies' orders share one browser store; `byClient(name)` merely filters `clientName === name`. This is presentation filtering, not an authorization boundary. Shared-origin scripts/devtools can access or change locally held records and files.
- Use backend session identity and immutable `client_id` for every company-owned query and mutation, including attachment/document downloads. Never accept company name, order ID, or file ID alone as authorization. Existing frontend role checks do not protect data.
- Existing backend foundations include HttpOnly, SameSite=Lax session cookies (Secure in production), active-user/session checks, login/registration rate limits, and same-origin JSON checks for writes. Origin checks require configured `APP_ORIGIN`; reuse these controls for future writes. Admin application review already has server role/permission enforcement.
- The backend already links approved users to clients; expose an appropriate client identity/profile contract and validate client account type/linkage for future portal endpoints. Clear company-scoped cached data on identity changes/logout when replacing the shared browser store.

## Recommended implementation order and likely files

1. Connect auth/register/logout/session restoration and remove production demo access: `components/Login.tsx`, `App.tsx`, `store/session.tsx`; add a shared frontend API client. Extend `backend/src/controllers/auth.controller.js` and the identity response as needed.
2. Establish server-side client/company scoping and profile read/update APIs, then persist real profile/preferences: auth middleware plus new backend routes/controllers/services, `ClientPortal.tsx`, `store/clientCompanySettings.ts`.
3. Add scoped inquiry/specification and attachment APIs with full validation; adapt `store/orders.tsx`, `store/attachments.ts`, wizard components, and `store/filterTemplates.ts`. Assess existing schema only when designing these APIs.
4. Connect client order/status/document reads and quotation/PO/revision/cancellation actions; fix JO selection by inquiry ID. Main files: `ClientPortal.tsx`, order store, `JOTemplateModal.tsx`, `QuotationPreviewModal.tsx`, `InvoicePreviewModal.tsx`.
5. Connect invoices/payment proof and logistics/signed receipts, then notifications/preferences and real password management. Main files: portal tabs, order/attachment/notification stores, `NotificationBell.tsx`, new backend modules. Extract portal tabs/wizard into separate components as implementation proceeds.

## DATABASE CHANGE REPORT

| Category | Change |
| --- | --- |
| Tables / columns / schema | None |
| Indexes / constraints / relationships | None |
| Migrations / seeds | None |
| Records / data | None |
| Database users / grants / RBAC | None |
| Database configuration / connections executed | None |
| Application / API implementation | None |
| Artifact created | `docs/CLIENT_PORTAL_AUDIT.md` only |

No commits, pushes, or deployment performed. Future database changes are undetermined and require a separate schema assessment.
