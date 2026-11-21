"""Author database reference documents from explicitly approved source text only.

No database imports, subprocesses, assertions, checksums or migration discovery.
"""
from pathlib import Path
import re

root = Path.cwd()
docs = root / 'docs'
source = (docs / 'PHASE_2_TASK_001_SCHEMA_SOURCE_APPENDIX_2026-11-21.md').read_text(encoding='utf-8')
review = (docs / 'PHASE_2_TASK_001_DATABASE_ARCHITECTURE_REVIEW_2026-11-21.md').read_text(encoding='utf-8')
reference = docs / 'erd-reference'
reference.mkdir(exist_ok=True)
for filename, destination in [
    ('EnterFlow_ERD_Revised.md', 'EnterFlow_ERD_Revised.md'),
    ('EnterFlow_ERD_Attributes_PK_FK_Cardinalities.md', 'EnterFlow_ERD_Original.md'),
]:
    (reference / destination).write_text((root.parent / filename).read_text(encoding='utf-8'), encoding='utf-8')

def parts(body):
    body = re.sub(r'--[^\n]*', '', body)
    result, start, depth, quote = [], 0, 0, False
    for i, ch in enumerate(body):
        if ch == "'":
            quote = not quote
        if not quote:
            if ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
            elif ch == ',' and depth == 0:
                result.append(body[start:i].strip())
                start = i + 1
    result.append(body[start:].strip())
    return [x for x in result if x]

tables = {}
for name, body in re.findall(r'^## (\w+)\n.*?```text\n(.*?)\nTable options:.*?```', source, re.M | re.S):
    tables[name] = parts(body)

# Apply the documented source-aware materials overlay in the reference model.
# This does not execute or authorize the historical ALTER or its DML transition.
overlay = source.split('## Source aware material changes', 1)[1].split('```text\n', 1)[1].split('```', 1)[0]
for operation in parts(overlay):
    if operation.startswith(('MODIFY ', 'ADD COLUMN ')):
        column = re.sub(r'^(MODIFY |ADD COLUMN )', '', operation)
        column = re.sub(r'\s+AFTER\s+\w+$', '', column)
        name = column.split()[0]
        old = next((i for i, x in enumerate(tables['materials']) if x.split()[0] == name), None)
        if old is None:
            tables['materials'].append(column)
        else:
            tables['materials'][old] = column
    elif operation.startswith('DROP CHECK '):
        tables['materials'] = [x for x in tables['materials'] if not x.startswith('CONSTRAINT ck_material_values ')]
    elif operation.startswith(('ADD UNIQUE KEY ', 'ADD CONSTRAINT ')):
        tables['materials'].append(operation[4:])

for filename in ['E01_request_snapshot_provenance.sql', 'E02_quotation_lineage.sql']:
    sql = (root / 'database' / 'erd-corrections' / filename).read_text(encoding='utf-8')
    sql = re.sub(r'--[^\n]*', '', sql)
    for name, body in re.findall(r'ALTER TABLE (\w+)\s+(.*?);', sql, re.S):
        for operation in parts(body):
            tables[name].append(re.sub(r'^ADD (?:COLUMN )?', '', operation))

new_sql = (root / 'database' / 'erd-corrections' / 'E03_revised_workflow_entities.sql').read_text(encoding='utf-8')
new_names = []
for name, body in re.findall(r'CREATE TABLE (\w+)\s*\((.*?)\) ENGINE', new_sql, re.S):
    tables[name] = parts(body)
    new_names.append(name)

purposes = {}
for name, purpose in re.findall(r'^\| `(\w+)` \| ([^|]+) \|', review, re.M):
    purposes[name] = purpose.strip()
purposes.update({
    'job_order': 'Intended one-PO manufacturing header with accepted quotation ownership.',
    'job_order_item': 'Manufacturing item and immutable complete template specification snapshot, exact accepted quote line.',
    'job_order_stage': 'Sole target per-header stage state; existing production events remain audit evidence.',
    'material_shortage_report': 'Typed shortage against raw material, JO and optional same-JO stage.',
    'production_plan': 'Documented repeat-item forecast and/or JO plan, without procurement or automatic production.',
    'client_receipt': 'Manual-review proof submission, separate from confirmed money.',
    'client_receipt_file': 'Many uploaded evidence files per receipt; existing private files reused.',
    'payment_transaction': 'One confirmed monetary event; stable replay identity independent of attachments.',
    'stock_movement': 'Single intended typed raw/finished ledger; unknown-before observations remain nonarithmetic.',
    'delivery': 'Intended dispatch/delivery aggregate deriving PO/client/invoice through JO; source facts preserved.',
    'delivery_item': 'Positive delivered item allocation with same-JO ownership.',
})
legacy = {
    'shipments': 'RETIRE after full delivery/item transfer, child FK cutover and approval.',
    'shipment_events': 'REWIRE/RENAME as delivery event history; preserve IDs and all events.',
    'job_orders': 'LEGACY PRODUCT ROWS; map to target items, not active target JO headers.',
    'payments': 'LEGACY SUBMISSION/MONEY EVIDENCE; split only through approved identity mapping.',
    'payment_files': 'LEGACY FILE PURPOSE EVIDENCE; proof/official-receipt mapping must complete first.',
    'material_movements': 'LEGACY RAW MOVEMENT HISTORY; incomplete, not a trustworthy opening balance source.',
    'finished_good_movements': 'LEGACY FG HISTORY; preserve independently until reconciled target activation.',
}
rewire = {'job_bom_lines', 'production_events', 'job_order_files', 'waybills', 'delivery_receipts'}
def status(name):
    if name in new_names:
        return 'NEW EMPTY TARGET CANDIDATE; inactive until approved compatibility/cutover.'
    if name in legacy:
        return legacy[name]
    if name in rewire:
        return 'RETAIN with later approved JO-item/stage or delivery FK cutover; current carrier shown below.'
    return 'RETAIN; additive E01/E02 overlay included where applicable.'

def column_parts(items):
    cols, keys = [], []
    for item in items:
        if re.match(r'^(PRIMARY|UNIQUE|KEY|CONSTRAINT|FOREIGN)\b', item):
            keys.append(item)
        else:
            cols.append(item)
    return cols, keys

relationships = []
attribute_sections = []
dictionary_sections = []
for name, items in tables.items():
    cols, keys = column_parts(items)
    unique_sets = []
    for col in cols:
        if 'PRIMARY KEY' in col:
            unique_sets.append({col.split()[0]})
    for key in keys:
        if key.startswith(('PRIMARY KEY', 'UNIQUE KEY')):
            m = re.search(r'\(([^)]+)\)', key)
            if m:
                unique_sets.append({c.strip() for c in m[1].split(',')})
    col_lookup = {col.split()[0]: col for col in cols}
    for key in keys:
        m = re.search(r'FOREIGN KEY\s*\(([^)]+)\)\s*REFERENCES (\w+)\(([^)]+)\)', key, re.S)
        if m:
            carriers = [x.strip() for x in m[1].split(',')]
            upper = '0..1' if any(u <= set(carriers) for u in unique_sets) else '0..M'
            optional = any('NOT NULL' not in col_lookup.get(c, '') for c in carriers)
            relationships.append(f'| `{m[2]}` | `{name}({m[1]})` | {upper} | {"0..1" if optional else "1"} | `{m[3]}` |')
    attribute_sections.append(f'### {name}\n\n{status(name)}\n\n```sql\nCREATE TABLE {name} (\n  ' + ',\n  '.join(items) + '\n);\n```\n')
    rows = []
    for col in cols:
        cname, remainder = col.split(None, 1)
        ctype = re.split(r'\s+(?:NOT NULL|NULL|DEFAULT|AUTO_INCREMENT|PRIMARY KEY|CHARACTER SET|COLLATE)\b', remainder, maxsplit=1)[0]
        null = 'No' if 'NOT NULL' in remainder or 'PRIMARY KEY' in remainder else 'Yes'
        default = re.search(r'\bDEFAULT\s+((?:CURRENT_TIMESTAMP\(3\))|(?:\x27[^\x27]*\x27)|(?:[^\s,]+))', remainder)
        dvalue = default.group(1) if default else ('AUTO_INCREMENT' if 'AUTO_INCREMENT' in remainder else 'No explicit default')
        memberships = []
        if 'PRIMARY KEY' in remainder:
            memberships.append('PK')
        for key in keys:
            scope = key.split('REFERENCES', 1)[0] if 'FOREIGN KEY' in key else key
            if re.search(r'\([^)]*\b' + re.escape(cname) + r'\b[^)]*\)', scope):
                memberships.append('FK' if 'FOREIGN KEY' in key else ('UQ' if key.startswith('UNIQUE') else ('PK' if key.startswith('PRIMARY') else ('CHECK' if 'CHECK' in key else 'INDEX'))))
        rows.append(f'| `{cname}` | `{ctype}` | {null} | `{dvalue}` | {", ".join(dict.fromkeys(memberships)) or "—"} |')
    dictionary_sections.append(f'## {name}\n\n{purposes.get(name, "Retained existing source entity; exact relationships and constraints below.")}\n\n{status(name)}\n\n| Column | Type | Nullable | Default / generation | Key participation |\n| --- | --- | --- | --- | --- |\n' + '\n'.join(rows) + '\n\nExact declarations, collation, keys, CHECK expressions and indexes:\n\n```sql\n  ' + ',\n  '.join(items) + '\n```\n')

common = '''Date: 2026-11-21, Asia/Singapore. **Proposed staged correction, not deployed metadata.** No SQL or runtime verification was executed. Read the [correction report](PHASE_2_DATABASE_ERD_CORRECTION_REPORT.md) and [migration report](PHASE_2_DATABASE_MIGRATION_REPORT.md) for evidence, approvals, data reconciliation and compatibility gates.

Physical equivalents from the revised ERD are retained. The inventory below contains all 71 known source declaration bodies with the documented materials overlay and E01/E02 additions, plus 11 new E03 definitions. Retiring legacy structures are explicitly labelled and remain only for controlled transition/history; they are not an additional permanent business model. Definitions marked RETAIN/REWIRE still show existing carriers until the separately approved contract migration replaces them. They must not be deployed as a parallel active model.

These declarations are a documentation projection, not a bootstrap script: table dependency order, actual deployed drift and pending contract transformations prevent executing this document. Canonical executable candidates are the three explicitly named SQL files. All supplied CREATE candidates use InnoDB, utf8mb4/utf8mb4_unicode_ci; ASCII/binary and other column overrides remain as declared. Omitted FK actions in candidates use MySQL RESTRICT/NO ACTION semantics, never cascading business-history deletion. Live FK actions must still be reconciled.

Generated columns are not introduced. Derived totals/display aliases from the conceptual drawing need not be new stored facts: line totals derive from frozen quantity/price, clients/PO/invoices derive through owner chains, and notification read state belongs to recipients. No new lookup, report table, credentials store, invented prices/BOM or population is introduced.

'''
gaps = '''## Known objects whose complete current DDL is unavailable

`user_sessions` is retained. Current service SQL requires `id`, `user_id`, `token_hash`, `expires_at`, `last_activity_at`, `revoked_at`; complete types/defaults/key actions and any additional columns remain an explicit metadata gap. User relationship, unique token digest lookup, revocation/expiry filtering are required. Do not invent session DDL or retrieve token values.

`_enterflow_migration_history` is retained infrastructure. Previously recorded implementation contract: `file VARCHAR(255) ASCII binary PK`, `checksum CHAR(64) ASCII NOT NULL`, `state ENUM('applying','applied','failed') NOT NULL`, `method ENUM('execute','baseline') NOT NULL`, `started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)`, nullable `applied_at DATETIME(3)` and `error_code VARCHAR(80)`. This is only a structure description, not a protected row/checksum read. No history query is authorized. `schema_migrations` is distinct and retained unchanged.

Later `users(client_id)` uniqueness is required by approved one-company-login policy but not established by the original source body. E02's `(id,client_id)` UQ is an ownership key and **does not** enforce one login per company. Confirm actual unique client key before any corrective DDL; do not infer it from E02.

Full deployed completeness remains blocked until authorized metadata is supplied; this document does not fill unknown schemas with guesses.
'''
relhead = '''## Complete declared FK cardinalities

Parent-to-child upper bounds derive from child unique/primary keys. Parent lower bound is zero at the database level: a FK alone does not force a parent to have a child. Child-to-parent optionality reflects nullable carriers. Workflow requirements for at least one item, exactly ten valid stage definitions, complete snapshots and sequence ordering need coordinated transaction validation. No assertion of actual row occupancy is made. Legacy rows are labelled in the entity definitions; their current FKs are not the final intended contract.

| Parent | Child FK carrier | Parent → child | Child → parent | Referenced columns |
| --- | --- | --- | --- | --- |
'''
diagram = '''## Corrected business relationships

```mermaid
erDiagram
  roles ||--o{ users : authorizes
  clients ||--o| users : portal_account
  clients ||--o{ orders : submits
  orders ||--o{ order_items : contains
  orders ||--o{ quotations : revisions
  quotations ||--o{ quotation_lines : contains
  quotation_lines o|--o| quotation_costing : exact_lineage_pending
  quotation_costing ||--o{ quotation_bom_lines : freezes
  materials ||--o{ quotation_bom_lines : identifies
  orders ||--o| purchase_orders : accepted_PO
  quotations ||--o| purchase_orders : accepted_revision
  purchase_orders ||--o| job_order : issues
  job_order ||--o{ job_order_item : manufactures
  quotation_lines ||--o{ job_order_item : accepted_snapshot
  job_order ||--o{ job_order_stage : tracks
  production_stages ||--o{ job_order_stage : defines
  job_order ||--o{ material_shortage_report : reports
  orders ||--o| invoices : bills_before_JO
  invoices ||--o{ client_receipt : evidence
  client_receipt ||--o{ client_receipt_file : photos
  files ||--o{ client_receipt_file : private_object
  invoices ||--o{ payment_transaction : confirmed_money
  client_receipt o|--o{ payment_transaction : allocation_decision_pending
  job_order ||--o{ delivery : dispatches
  delivery ||--o{ delivery_item : allocates
  job_order_item ||--o{ delivery_item : delivers
  delivery ||--o| waybills : planned_rewire
  delivery ||--o| delivery_receipts : planned_rewire
  delivery_receipts ||--o{ signed_delivery_receipts : retains_all_copies
  materials o|--o{ stock_movement : XOR_raw
  finished_goods o|--o{ stock_movement : XOR_finished
  job_order o|--o{ stock_movement : optional_reference
  orders ||--o{ stock_requests : checks_without_reservation
  stock_requests ||--o{ stock_request_lines : snapshots
  materials ||--o{ stock_request_lines : identifies
  clients ||--o{ production_plan : forecasts
  finished_goods o|--o{ production_plan : repeat_item
  job_order o|--o{ production_plan : scheduled_job
  notifications ||--o{ notification_recipients : recipients
  users ||--o{ notification_recipients : reads
```

The diagram shows the **intended** target after cutover; waybill/DR rewiring is not in E03. Exactly one raw/finished FK per stock movement is enforced by CHECK, not by the two optional diagram edges. Receipt allocation cardinality awaits approval; existing one-PO-per-inquiry and accepted-reference revision semantics remain. Ten-stage definition/sequencing, atomic ledger/balance consistency and immutable snapshots are pending activation gates, not guarantees created by this diagram.

'''
(docs / 'PHASE_2_DATABASE_CORRECTED_ERD.md').write_text('# Phase 2 corrected ERD and staged physical model\n\n' + common + diagram + relhead + '\n'.join(relationships) + '\n\n## Every known table and attribute\n\n' + '\n'.join(attribute_sections) + '\n' + gaps, encoding='utf-8')
(docs / 'PHASE_2_DATABASE_DATA_DICTIONARY.md').write_text('# Phase 2 database data dictionary\n\n' + common + '''Each section describes purpose, disposition, every known column type/null/default and exact keys/checks. Column key participation is an aid; composite scopes and CHECK expressions are authoritative in the declaration block. See the ERD FK table for parent/child cardinalities. Existing default zeros do not establish observed stock or approved prices. Source-aware material definitions replace the original defaults/checks rather than classifying records. Text dimensions retain original units/free text; new manufacturing items copy them at issuance from authentic evidence.

''' + '\n'.join(dictionary_sections) + '\n' + gaps, encoding='utf-8')
print('Authored two database documents and preserved two ERD text references; no SQL executed.')
