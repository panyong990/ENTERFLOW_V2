# Integrated MAIN / DEV-PHASE visual restoration evidence

The old standalone ENTER-FLOW application and historical reconstruction fixtures are excluded from restoration decisions.

## Confirmed running references

- MAIN: C:/Users/amiaz/Downloads/ENTERFLOW_MAIN_INTEGRATION, branch integration/main-merge, e59364c1, http://127.0.0.1:5193.
- DEV-PHASE: C:/Users/amiaz/Downloads/ENTERFLOW_V2, branch dev-phase, 19d1dc76, http://127.0.0.1:5194.
- Current application: C:/Users/amiaz/Downloads/ENTERFLOW_DEV_INTEGRATION, integration/dev-phase-merge.

Chromium opened both reference applications. MAIN's existing Demo controls expose all nine roles, including Admin. DEV-PHASE opens authenticated login without staff Demo controls. DEV-PHASE staff screens have not been visually verified; no credentials or authorization bypass were used.

MAIN screenshots and observed control inventories are in .vite/integrated-main-browser. The navigation.json file records each module actually visited. details.json records Sales quotation tabs and Client sections. interactions.json records attempted forms and dialogs, including controls that could not be opened normally.

## Quotation correction from the rendered MAIN application

MAIN's actual quotation modal displays the existing root CostEstimationPanel and QuotationBuilder components. These components already exist in the current checkout. The separate RealQuotationPreparation form bypassed their layout and interactions.

RealQuotationPreparation now uses those components through the existing presentation adapter and recovered modal shell. It retains authenticated stock reads and the existing quotation POST adapter. It maps per-product labor and markup plus shared VAT/discount settings, terms, notes, note highlighting and mandatory 20%/50% downpayment. A submission lock prevents concurrent requests. Server errors leave the modal open.

The original material column remains visible as a disabled catalog reference; its prices and cost summaries are unavailable until calculated by the server. The current endpoint does not accept arbitrary material/BOM edits, packaging, freight, or edited order-line quantities/descriptions. Those operations are prevented or explicitly explained. No catalog balances or client-side calculations become authoritative quotation prices.

The reused component needed a Real Mode effect correction: readonly-provider method rebinding caused costing inputs to reset. The browser regression verifies per-product values reach the adapter unchanged.

Original Demo behavior uses the existing component branch. The integrated application continues to use Inter, matching both integrated references. The temporary standalone-derived font edit was fully undone.

## Nine-role evidence and outstanding work

| Role | MAIN pages captured | Remaining visual work |
| --- | --- | --- |
| Admin | Dashboard, Client Management, Employee Management, Roles & Permissions | Compare current authenticated forms and populated states; DEV-PHASE authenticated reference needs an authorized session. |
| Owner | Analytics, Client Management, Employee Directory, Settings | Compare all current screens and dialogs against MAIN and accessible DEV-PHASE reference. |
| Operations | Dashboard, Sales, Production, Inventory, Waybill Monitoring, Logistics, Clients, Settings | Current populated states and interactions not comprehensively compared. |
| Sales | Dashboard, Sales pipeline, Clients; quotation inquiry/cost/document tabs | Quotation compared with current Chromium screenshots. Remaining Sales dialogs and successful live persistence are not accepted as verified. |
| Accounting | Dashboard, Payments Ledger, Delivery Receipts | Current ledger, proof queue and document views need direct comparison. |
| Production | Dashboard, Production Floor | Current Real screen replaces original stage-card body; restoration still outstanding. |
| Warehouse | Dashboard, Inventory, Waybill Scanner, Waybill History | Current inventory and stock-request dialog need direct comparison. |
| Logistics | Dashboard, Logistics | Current active/history/detail views need direct comparison. |
| Client | Orders, Status, Logistics, Accounting, Settings | Current populated forms, history, documents and notifications need direct comparison. |

No role-wide restoration or full-application visual acceptance is claimed. Reference capture and quotation restoration are concrete progress; remaining roles are not declared complete.

## 18 November 2026 Warehouse reference recovery

The recorded integrated MAIN commit e59364c1c9bd0257c82319df29e84081740ff694 is available locally. Its frontend was previewed from read-only Git object loads in isolation, without switching branches or restoring the working tree. Warehouse was opened through its existing preview control. New Warehouse-only MAIN/current captures and provenance are now in `.vite/integrated-main-browser/`; this does not restore all previously listed nine-role screenshots.

The full 71-material backing catalog was compared with the current repository: codes, names, categories, units, prices and thresholds match exactly, with no duplicate codes/names. Default stock quantities were not accepted as verified physical counts. See `docs/WAREHOUSE_INVENTORY_PHASE_1_REPORT.md` and `docs/inventory-reconciliation/` for scope, tests, data approvals and remaining acceptance limits.
