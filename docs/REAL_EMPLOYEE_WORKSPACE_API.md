# Real employee workspace API plan

## Implemented in the shell milestone

`GET /api/workspace/sales/readiness` authenticates the existing session, requires an employee with role `sales`, and checks `inquiries:read` plus `clients:read` server-side. It returns a no-store capability response only. It reads no operational tables and enables no writes. Other paths/methods under this prefix are unavailable.

## Sales Manager contract inventory (proposed; not yet implemented)

| UI area / operation | Proposed API | Required authorization | Current status |
|---|---|---|---|
| Dashboard KPIs and pipeline counts | `GET /api/sales/dashboard` | `inquiries:read`, `quotations:read`, `orders:read`, `clients:read` | Demo-store data only |
| Sales pipeline list/detail and stage filters | `GET /api/sales/orders?stage=&cursor=&limit=`; `GET /api/sales/orders/:id` | `orders:read` (and inquiry/quotation reads for joined data) | Demo-store data only |
| Create inquiry | `POST /api/sales/inquiries` | `inquiries:create` | Blocked: current Sales permission map has no `inquiries:create` grant |
| Edit inquiry / cancellation decisions | `PATCH /api/sales/inquiries/:id` | `inquiries:update` plus operation-specific validation | Demo-store mutations only |
| Create/edit/approve quotation | `POST /api/sales/quotations`; `PATCH /api/sales/quotations/:id`; `POST /api/sales/quotations/:id/approve` | `quotations:create/update/approve` respectively | Demo-store mutations only |
| Record PO/order progression, invoice/JO actions | `POST`/`PATCH /api/sales/orders/:id/...` operation-specific subresources | `orders:create/update/approve`; additional production/inventory checks where side effects occur | Demo-store mutations only; exact transaction boundaries and validators need domain/API design |
| Client list and profile/detail | `GET /api/sales/clients`; `GET /api/sales/clients/:id` | `clients:read` | Current `Clients` component uses embedded sample rows and shared order store |
| Client profile changes | `PATCH /api/sales/clients/:id` | `clients:update` | Demo/local only; no real route |
| Notification list, read/clear, replies | `GET /api/notifications`; `PATCH /api/notifications/:id` | Needs an explicit notification resource/action policy and recipient scoping | Seeded/localStorage notifications only |

For list APIs, use bounded pagination and server-side role scoping. Mutation payloads should carry an expected revision for concurrency, be validated server-side, use same-origin/CSRF protection, and write audit events in the same transaction. Do not enable UI actions until the matching endpoint, permission, validator, persistence service, audit behavior, and tests exist. No operational table or permission changes are part of this milestone.

## Data boundary

The real shell intentionally does not mount `OrdersProvider`, `MaterialsProvider`, `NotificationsProvider`, or other Demo data providers. It displays explicit unavailable states instead of rendering their sample-backed workspace content. Demo Mode continues to use the existing providers and components.
