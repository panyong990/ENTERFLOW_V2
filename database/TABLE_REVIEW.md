# Table purpose and duplication review

Reviewed against current `src/app/App.tsx`, business components and stores, the system flowcharts, pasted UI requirements, and historical QA notes. No research paper or standalone ERD was found. The flowcharts and notes are documentary evidence, not proof of a backend. See FRONTEND_ANALYSIS.md for full fields, roles, validations and disagreements.

**Decision: retain the original 69 tables.** None is an exact duplicate with the same lifecycle and ownership. Several are small lookup/junction tables; their count alone is not a reason to remove them. Add one narrowly scoped `quotation_references` ownership table: **70 tables total**. It prevents a quote number being shared across unrelated orders while preserving revisions that reuse the number. No functionality was removed.

## Complete table inventory

| Table | Source / purpose | Review |
| --- | --- | --- |
| `schema_migrations` | Ordered one-time migration/seed completion | Infrastructure; retain |
| `roles` | Login/Sidebar nine roles | Shared lookup; retain |
| `modules` | App/Sidebar module IDs | Shared lookup; retain |
| `role_modules` | RolesPermissions read-only access matrix | Many-to-many grants; not authentication |
| `payment_terms` | Order/quotation 15/30-Day Terms | Shared lookup; COD policy unresolved |
| `clients` | Clients, client account/company settings | One company identity; not a duplicate login |
| `users` | Accounts, employee management, client login | Credentials/account identity distinct from company |
| `client_applications` | Login registration and Admin review | Pre-approval state and rejection history; not an active client duplicate |
| `filter_types` | store/filterTemplates 16 types/6 groups | Global type catalogue, distinct from per-client dimensions |
| `product_specifications` | ProductLine/JOSpecs/finished-good specs | Shared column structure for client-owned specification snapshots; separate rows for issued JO copies |
| `material_categories` | PartCategory / Inventory groups | Shared lookup |
| `units` | Material UOM choices | Shared lookup |
| `materials` | Inventory raw materials | Current catalogue and stock balance |
| `bom_templates` | CostEstimation save/apply template | Reusable draft recipe/configuration |
| `bom_template_lines` | Template BOM array | Repeating child material requirements |
| `files` | Upload/preview/download requirements | One GCS metadata record per object; no bytes/URLs |
| `order_stages` | store/orders Stage union | UI workflow codes; financial sums still derived |
| `delivery_methods` | Quotation/Logistics method choices | Shared lookup |
| `orders` | Inquiry -> commercial order workflow | Original client/order identity; child JOs do not clone financial records |
| `order_items` | Inquiry products array | Product/quantity children, not separate orders |
| `quotation_references` | QuotationBuilder reuses quotationNo; history in SalesOrders | New unique number-to-order ownership; permits revisions and does not force one number per order |
| `quotations` | QuotationDoc/history | Revision-specific header, sent state and financial snapshot |
| `quotation_lines` | Editable issued line-items table | Client-facing line description/quantity/price |
| `quotation_costing` | CostEstimation configuration per product | Internal labor/markup/VAT/discount inputs; distinct from editable selling price |
| `quotation_bom_lines` | Per-product quotation BOM | Cost-time material/name/unit/price snapshot |
| `quotation_discounts` | QuotationDoc discount array | Ordered repeating discount labels/rates |
| `quotation_addons` | Packaging/shipping editors | Two supported typed optional add-ons, not ordinary fabrication BOM |
| `purchase_orders` | Client upload / Sales receive/clear | Accepted quotation, client PO reference and staff confirmation |
| `order_requests` | Revision/cancellation/urgent flows | Combined shared request lifecycle; avoids three similar tables |
| `document_sequences` | Generated Q/PO/JO/SI/DR numbering | Transactional counter; not a second business-document table |
| `production_stages` | store/orders nine production stages | Shared lookup; completed cursor is not a tenth stage |
| `replacement_requests` | ReplacementRequest/actions/proof | Separate defect/quantity/JO lifecycle; eligibility remains unresolved |
| `job_orders` | finalizeProductJOs / ProductionFloor | Product-specific manufacturing children |
| `job_bom_lines` | BOM used for issued JO deduction/restoration | Frozen manufacturing basis; do not recalculate from later quotation/material edits |
| `production_events` | StageEntry/history/revert/pause | Append-oriented operational history, not a generic audit duplicate |
| `material_movements` | Inventory recount/receipt/JO deduction | Structured quantity ledger plus idempotency |
| `material_changes` | AuditEntry.changes | Non-quantity catalogue edits; separate from movement arithmetic |
| `finished_goods` | Inventory finished tab | Client item/PN/buffer/stock; not raw material |
| `finished_good_movements` | Finished-good stock history | Quantity audit at a different inventory entity |
| `finished_good_order_items` | recurringOrders / FinishedGoodsOrderActivity | Explicit historical match replacing fuzzy client-name/PN joins; not a stock allocation |
| `stock_requests` | StockRequestsModal / stockRequests store | Sales request header and update request |
| `stock_request_lines` | requestedMaterials | Material needs and request-time snapshot |
| `stock_responses` | responseHistory | Versioned Warehouse reply header |
| `stock_response_lines` | Response materials | Response-time balances/shortages; distinct from request-time data |
| `quotation_stock_responses` | QuotationDoc.warehouseStockResponse | Binds the revision to the precise response snapshot |
| `shipments` | Logistics and ClientPortal Logistics | Delivery/pickup tracking and contacts |
| `waybills` | Scanner/print/history/monitoring | QR identity and printed state; not a signed acceptance receipt |
| `shipment_events` | waybillLog / dispatch history | Shipment status history distinct from production |
| `delivery_receipts` | Accounting DR generation/handoff | Generated DR identity and send events |
| `signed_delivery_receipts` | Stage/discard/submit signed DR | Uploaded copies and acceptance; different lifecycle from generated DR |
| `invoices` | generateInvoice/sendInvoice / Accounting | Bill and payment terms, separate draft/send events |
| `invoice_delivery_receipts` | Recorded signed-DR payment-cycle basis | Binds invoice to same-order accepted evidence; does not decide first/last receipt policy |
| `payments` | Canonical PaymentRecord | One ledger; legacy receipts/confirmedPayments are intentionally not separate tables |
| `payment_instructions` | downpaymentPaymentDetails | Snapshot of instructions actually sent for an order; not a payment or bank credential |
| `company_settings` | store/settings / Settings | Company/letterhead/default driver/default bank details |
| `company_payment_methods` | Configurable paymentMethods array | Multiple selectable methods/details distinct from legacy default-bank fields |
| `notifications` | NotificationsCenter/NotificationBell | Message content and optional related order/reply |
| `notification_roles` | Notification.recipients | Intended role audience at creation |
| `notification_recipients` | Per-user read/dismiss state | Actual delivered recipient snapshot; not a second message |
| `order_files` | Inquiry sketch/supporting document | Typed business FK; not another file metadata store |
| `specification_files` | Per-product sketch/image | Typed specification FK |
| `quotation_files` | Issued/signed quote | Typed revision FK |
| `purchase_order_files` | Client PO document | Typed PO FK |
| `job_order_files` | Issued JO/sketch/carried signed quote | Typed JO FK; allowed shared file only after authorization |
| `payment_files` | Receipt/proof upload | Typed payment FK |
| `invoice_files` | Issued invoice document | Typed invoice FK |
| `waybill_files` | Saved generated waybill | Typed waybill FK |
| `delivery_receipt_files` | Generated DR document | Typed DR FK; signed copies use their lifecycle table |
| `replacement_request_files` | Defect proof | Typed replacement FK |
| `audit_events` | Account/client/security changes | Cross-module security/change evidence; do not copy every domain event here |

## Overlap and possible simplifications

- **Templates, quotation BOM and JO BOM:** similar columns represent reusable recipes, price-at-quotation snapshots and issued manufacturing requirements. Merging their rows would risk changing historical costing or manufacturing instructions when templates/prices change. Keep separate ownership/lifecycles.
- **Quotation lines versus costing:** clients can edit selling lines independently of the manufacturing estimate. They are not interchangeable. Discounts in costing and document discounts also have different calculation stages; the exact ordering still needs approval.
- **`quotation_stock_responses`:** a single nullable stock_response_id/order_id pair could be placed on quotations instead. The retained junction expresses the selected snapshot and keeps ordered CREATE-only migrations without a circular dependency or ALTER step. This is a valid representation choice, not additional business functionality.
- **`finished_good_order_items`:** source currently computes text matches. A link is justified for stable historical matches after client/PN renames; it must not be mistaken for inventory reservation/fulfillment allocation. Product identity matching still needs service/user review.
- **Notification role targets and per-user recipients:** these can be simplified to recipients only if historical audience intent is no longer needed. Current role targeting and persistent read state justify both; role-target changes must not retroactively grant another client's message access.
- **Material changes versus generic audit:** structured per-field changes are required by Inventory audit views. Generic audit should cover account/client/security activity without duplicating the material change payload. No triggers or duplicate write streams are added.
- **Company default bank fields versus payment-method details:** both occur in the current settings model. They can drift unless a future settings service has an explicit synchronization/deprecation rule. Do not drop source fields during this database review.
- **Typed attachment links:** similar shapes intentionally keep actual parent FKs and record-specific purposes. A polymorphic entity_type/entity_id table would reduce count but lose database-enforced parent integrity. No file bytes/metadata are duplicated by these links.
- No standalone dashboard, KPI, revenue summary, recurring-order subscription, legacy receipt, confirmed-payment, supplier purchasing or local-file storage table is needed or added.

Potential future simplifications require an explicit decision about the corresponding behavior; none is needed to execute the integrity fixes. Retention, reference and entity cardinality decisions are in PHASE2_REVIEW.md.
