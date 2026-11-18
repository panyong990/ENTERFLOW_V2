# Separate BOM requirements and missing-data plan

November 18, 2026. Primary reference: comprehensive handoff §§17,18,24; original handoff §§7.4–7.5. **No BOM dataset is supplied or approved.** Material catalog entries identify available reference materials; they do not specify how any filter is manufactured.

## Required approval inputs

For each product/filter type and size: manufacturing owner, approved source document and revision/date, applicability/size criteria, complete material list by authoritative catalog code, per-product quantity, consumption unit, waste percentage, and any approved conversion to the catalog's pricing unit. Supply a worked material-cost and demand example plus an approval record. Do not infer assignments from material names, static UI choices, existing example quantities or the single historically reported AIRFIL inquiry.

After authorized catalog reconciliation, resolve each catalog code to its actual numeric materials.id as a decimal string. Missing/ambiguous mappings block the line; do not invent sequential IDs. Verify filter_types.code on the approved target; no filter-type insert is proposed here.

## Exact existing schema fields to populate later — no values proposed

| Table | Required approved values | Generated/reference values |
|---|---|---|
| bom_templates | filter_type_code, size_label applicability, labor_cost, markup_percent, discount_percent, vat_type, vat_rate, include_labor, apply_markup, apply_vat; notes if approved | id from database; created_by must be authorized actual user; created_at existing default |
| bom_template_lines | template_id, line_number, material_id, quantity_per_filter, waste_percent | template/material IDs resolved after approved inserts/reconciliation |

The current schema has no template active flag or description column; do not invent one. Preserve positive quantity_per_filter and waste range 0..100, decimal precision, unique template/line identity and foreign keys. Required template cost/tax flags must have explicit business-approved values; existing schema defaults are not manufacturing approval.

No INSERT, UPDATE, schema change or backfill is proposed for these tables yet: an exact data plan is impossible until these inputs exist. The generated bom-business-data-required.json deliberately contains empty templates and lines.

## Current source selection and costing behavior requiring review

backend/src/services/sales-orders.service.js selects by filter_type_code with size_label matching inquirySize(height), falling back to NULL size; ordering prefers exact size then lowest template ID. It then uses all selected-template lines. Confirm that the existing height-derived selection matches business applicability; do not create overlapping templates simply because the schema permits them. No general multi-dimension or OEM-selection extension is authorized by this plan.

Quotation material cost per product uses unit_price × quantity_per_filter × (1 + waste_percent / 100), followed by existing labor, markup, discount and VAT rules. Current stock assessment uses quantity_per_filter × ordered quantity without the costing waste multiplier. Obtain explicit confirmation whether waste belongs only in costing or also in stock-demand planning; this task does not silently change that rule.

Unknown quantity_on_hand does not mean zero. Missing template/material mapping remains unmapped or MATERIAL_COSTING_INCOMPLETE as appropriate. A complete catalog with valid prices does not cure absent BOMs. No automatic deduction/reservation on inquiry review, quotation or JO creation; Sales may quote insufficient stock with appropriate lead time. Stock Requests remain manual and there is no Procurement module.

## Missing-data collection and separate review sequence

1. Business/manufacturing owner supplies a product/size BOM source with the fields above; do not fill the request with guessed examples.
2. Validate source completeness, unit compatibility, waste policy, per-product quantities and ambiguity. Require conversions to be reviewed, not inferred (e.g. kg versus sheet/roll).
3. Obtain actual material and filter-type references under separately authorized reads; preserve numeric IDs as strings.
4. Prepare a separate exact BOM insert/reuse/conflict plan and digest; show target, transactional write set, duplicate handling, backup/recovery and affected tables before seeking approval.
5. Test with isolated synthetic fixtures: matching/fallback/ambiguous/missing templates, missing/inactive material, unknown/zero/insufficient stock, no-write availability, exact costing/VAT/discount/downpayment, immutable quotation snapshots and no automatic stock writes.
6. Only after separate target/data/operator approval, verify real save/send/revision persistence and Client visibility with actual approved inputs. No such execution is authorized here.

## Dependencies and acceptance evidence

Stock representation decision precedes safe unknown-stock catalog import. Actual ID mapping follows committed/reconciled catalog data. BOM business data follows its own approval gate; neither catalog nor nullable-schema approval authorizes guessed BOM population. Existing quotation_bom_lines and job-order snapshots must remain historical; do not rewrite them from new templates.

Offline evidence does not establish current MySQL contents. The November 18 saved snapshot reports zero templates/lines, but is not refreshed by this task. No MySQL, SQL execution, migrations, protected Migration 007, Docker, cloud resources, schema or data changes occurred.

