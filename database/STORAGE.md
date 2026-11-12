# Private Google Cloud Storage design (future integration only)

No APIs, cloud resources, buckets, IAM changes, credentials or chargeable services were created.

## Metadata and relational ownership

`files` contains file ID, original filename, MIME type, byte count, bucket, object path, optional object generation/SHA-256, state, uploader FK, upload time and deletion time. It contains no binary payload, base64, public URL or temporary signed URL. States distinguish incomplete uploads from usable files.

Use server-generated ASCII object paths such as `orders/<order-id>/<file-id>/<random-uuid>.pdf` (maximum 700 ASCII characters by this design). Do not use user filenames, company names or other private information as paths. The original filename is display metadata only; sanitize it before sending Content-Disposition. Store the bucket on each file, not only in environment configuration, so existing objects remain resolvable when the backend deploys or defaults change. Objects are immutable per path; record generation to address the uploaded version. The `(bucket, object_path)` unique key prevents accidental aliasing of distinct files to one object.

| File requirement | SQL link / parent authorization |
| --- | --- |
| Inquiry sketch or supporting document | `order_files` -> `orders` |
| Per-product sketch / product image | `specification_files` -> `product_specifications` -> owning order item, JO or finished good |
| Generated or signed quotation | `quotation_files` -> `quotations` -> order |
| Client PO | `purchase_order_files` -> `purchase_orders` -> order |
| JO document, JO sketch, carried signed quote | `job_order_files` -> `job_orders` -> order |
| Payment proof / official receipt | `payment_files` -> `payments` -> order/invoice |
| Generated invoice / waybill / DR | `invoice_files`, `waybill_files`, `delivery_receipt_files` -> their explicit parents |
| Signed DR, including staged copy | `signed_delivery_receipts` -> generated `delivery_receipts`, direct `file_id` FK |
| Replacement defect photo/document | `replacement_request_files` -> `replacement_requests` -> order |

Each link has actual parent and file foreign keys. No unenforceable `entity_type + entity_id` attachment ownership field. `purpose` distinguishes document kinds. Signed DR staging is distinct from acceptance: pending/discarded copies have received_at/accepted_slot NULL; an accepted copy has received_at set, accepted_slot=1 and discarded_at NULL. A CHECK enforces these states and UNIQUE(delivery_receipt_id, accepted_slot) allows at most one accepted copy per generated DR. Shared order IDs are constrained through shipment/DR/signed-copy; invoice evidence additionally requires the same order and accepted slot. Never match only by filename or frontend DR text.

The future API must create a file and its approved typed link together. Prevent orphan/unowned files from being read. If reusing an object in another record, verify both parents are accessible and belong to the appropriate client. Specifications should be separate frozen copies per issued JO; never share a mutable spec between unrelated clients. Authorize clients by authenticated `users.client_id`, staff by action permission and parent scope, never by browser-supplied company name, role or object path.

## Local upload/preview workflow

1. Authenticated React user selects a supported file. Local Express receives multipart input with configured byte limits. Validate action/client ownership, file extension, MIME and actual content; apply agreed malware checks. Never trust browser `accept`, filename or a client-supplied bucket/path. Permit only approved formats (current screens use PDF/JPEG/PNG); confirm business-specific limits before implementation.
2. Backend allocates a file ID, generated object key and `pending` metadata with parent link in a short transaction. Resolve `GCS_BUCKET` from server-only development configuration. Bucket name should be different from production; don't seed a guessed real name.
3. Stream file to a private GCS development bucket via the backend's development identity. Cloud Run uses runtime service identity; local development uses ADC with explicitly granted minimum permissions. Do not put service-account JSON in Git or frontend variables. Use object-generation preconditions to avoid overwriting an existing key.
4. After confirmed upload/checks, save authoritative size/type/generation/hash and mark `available` in a second transaction. GCS and MySQL cannot share an atomic commit. If upload or final commit fails, mark/track failure and retry or remove an orphan object through a bounded, authorized reconciliation task. Never expose pending/failed files. A later reconciliation task handles abandoned `pending` rows/objects after an agreed grace period.
5. For preview/download, backend loads the typed parent link and rechecks current authorization and file state. It either streams the private object or issues a short-lived V4 signed **GET** URL on demand. Signed URLs are bearer access for their lifetime: keep expiry short, do not log them or persist them in MySQL/localStorage, and use safe inline versus attachment response headers.
6. React can display images/PDFs using that authorized response. Browser print can generate documents without storing a PDF; if exact historical copies are needed, backend renders and stores the issued version as a private object and links it to the revision/document. No permanent local filesystem is required on Cloud Run; bounded temporary memory/disk may be used only while handling a request.

For a later bucket setup, use IAM with uniform bucket-level access and public access prevention. Signed access must be created by a suitably authorized signer; permission to upload is not automatically permission to sign URLs. A backend streaming endpoint is also a valid preview path. See [Google's access-control overview](https://docs.cloud.google.com/storage/docs/access-control) and [signed URL documentation](https://docs.cloud.google.com/storage/docs/access-control/signed-urls).

## Security and lifecycle decisions

- Database FK integrity does not implement document access control. File access events may use `audit_events`; do not write raw URLs, credentials, passwords or file contents into audit values.
- The schema rejects a second accepted signed copy and rejects pending/discarded or cross-order invoice evidence. Accepted copies linked to invoice evidence cannot be unaccepted while that FK remains. The service still locks the DR parent, verifies available GCS content and uploader/action authority, protects issued records from edits/deletion, and prevents pending-file cleanup from removing an accepted object. No acceptance revocation/correction workflow is assumed; that needs approval. Shared file metadata may still link to multiple parents, so authorize every reuse and access across all parent scopes.
- Archive orders rather than cascading deletes. FKs use restrictive deletion by default. Removing a file needs retention approval, object deletion plus database state update/retry, and preservation of audit references; no hard-delete cascade is supplied.
- Client settings, driver contacts, bank instructions and private documents require restricted response projections; avoid exposing internal notes or hashes in general record APIs.
- Bucket lifecycle, retention/versioning, recovery, backup alignment, signing TTL, size limits, malware treatment and development sample-data policy are unresolved operational configuration. Document them before implementing uploads. No real filenames, private uploads or bucket credentials are included in seeds.
