# Task 006 — Waybill QR Scan Verification Contract

Status: PREPARATION ONLY — NOT ACTIVATED

## Intended workflow

Generate Waybill -> Record Print -> Scan QR ->
Backend Verification -> Authorized DR Handoff

## Proposed endpoint

POST /api/phase2/warehouse/deliveries/:id/waybill/scan

Request:
- Delivery ID from the URL
- Scanned QR identifier in the JSON body
- Authenticated employee identity from the session

Never accept employee identity or verification status
from the request body.

## Verification requirements

1. Require an authenticated Warehouse employee.
2. Require an approved scan permission (pending review).
3. Enforce existing session and origin protections.
4. Validate delivery ID and QR input.
5. Look up the official Waybill on the backend.
6. Confirm delivery association and printed_at.
7. Recheck eligibility inside a database transaction.
8. Record the successful scan and actor atomically.
9. Define safe repeat-scan and unknown-commit handling.
10. Return VERIFIED only after confirmed persistence.

## Security

- Never log raw QR identifiers.
- Never expose QR identifiers through Logistics or Client APIs.
- Never trust client-provided Waybill metadata.
- Do not generate replacement QR identifiers during scanning.
- Preserve existing authentication and RBAC.
- Prevent a scan from changing delivery status directly.

## Historical pending design approvals (Task 006)

- Authorized permission for Warehouse scanning.
- Approved durable scan-recording mechanism.
- Whether repeat scans are idempotent or separately audited.
- Scan-before-DR handoff enforcement and rollout.
- Company Vehicle vs. third-party DR routing.
- Client Pick-up handling.

## Historical preparation restrictions (Task 006)

- No live endpoint activation.
- No database writes or migrations.
- No Accounting or Logistics workflow changes.
- No protected Migration 007 access.
- No automatic Git commit or push.