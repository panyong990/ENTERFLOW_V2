"""Document actual P2B002 metadata and revised-entity mapping, not old schemas."""
from pathlib import Path
import json
import re
import hashlib

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'database/phase2-execution/P2B002-2026-11-22'
DOC=ROOT/'docs'
data=json.loads((OUT/'after-metadata.json').read_text(encoding='utf-8'))
design=json.loads((ROOT/'database/phase2-bootstrap/P2B002_design_manifest.json').read_text(encoding='utf-8'))
run=json.loads((OUT/'execution.json').read_text(encoding='utf-8'))
verified=json.loads((OUT/'entity-relationship-verification.json').read_text(encoding='utf-8'))
if run['status']!='complete': raise RuntimeError('Cannot publish a completed report for an incomplete run')
extensions=set(design['extensions'])
refs={'delivery_method','payment_method','material_category','unit_of_measure','filter_type','production_stage','document'}
groups={}; indexes={}
for r in data['keys']: groups.setdefault((r['table'],r['name']),[]).append(r)
for r in data['indexes']: indexes.setdefault((r['table'],r['name']),[]).append(r)
types={(r['table'],r['name']):r['type'] for r in data['constraints']}
unique={name:[] for name in design['tables']}
for (name,key),rows in groups.items():
    if types.get((name,key)) in ('PRIMARY KEY','UNIQUE'): unique[name].append({r['column'] for r in rows})
columns={(r['table'],r['column']):r for r in data['columns']}
fk=[]
for (name,key),rows in groups.items():
    if rows[0]['parent'] is not None:
        carrier=[r['column'] for r in rows]
        one=any(u<=set(carrier) for u in unique[name])
        optional=any(columns[(name,c)]['nullable']=='YES' for c in carrier)
        fk.append({'child':name,'name':key,'columns':carrier,'parent':rows[0]['parent'],
            'parentColumns':[r['parentColumn'] for r in rows],
            'childCount':'0..1' if one else '0..M','parentCount':'0..1' if optional else '1'})
v=run['verification']
links='''[bootstrap](../database/phase2-bootstrap/P2B002_revised_erd_greenfield.sql), [design manifest](../database/phase2-bootstrap/P2B002_design_manifest.json), [actual metadata](../database/phase2-execution/P2B002-2026-11-22/after-metadata.json), [entity/relationship verification](../database/phase2-execution/P2B002-2026-11-22/entity-relationship-verification.json), [execution journal](../database/phase2-execution/P2B002-2026-11-22/execution.json).'''
intro=f'''Date: 2026-11-22, Asia/Singapore. **Executed P2B002 greenfield rebuild, not a proposal.** The rejected P2B001 model is not the current database. Target: `enterflow_phase2_db`, container `enterflow-phase2-mysql`, `127.0.0.1:62286`, MySQL 8.4.13. Actual result: {v['tables']} tables, {v['columns']} columns, {v['primaryKeys']} PKs, {v['foreignKeys']} FKs, {v['uniqueConstraints']} unique constraints, {v['enforcedChecks']} enforced CHECKs, {v['indexes']} indexes, {v['triggers']} ownership/history triggers; **zero rows**. Counts are outcomes, not design goals or sufficient proof of correctness.

Evidence: {links}

The design was authored from the actual `EnterFlow_ERD_Revised.md`, original/revised diagrams, documented scope/backlog/events/use cases in `Enter-Flow_Final.pdf`, and approved business decisions. The authoring reference matches the actual Downloads revised file in normalized text. The new authoring helper reads only that revised reference; it does not import old DDL, E01–E03, P2B001, an old dictionary or backup. Physical names follow the revised entities. The final entity set was derived as 27 main entities, seven references explicitly required by their FKs, and six individually justified workflow extensions.

'''

relation_rows=['| Parent | Child FK | Parent → children | Child → parent | Exact referenced columns | Actions |',
               '| --- | --- | --- | --- | --- | --- |']
actions={(r['table'],r['name']):r for r in data['referentialActions']}
for r in fk:
    a=actions[(r['child'],r['name'])]
    relation_rows.append(f"| `{r['parent']}` | `{r['child']}({', '.join(r['columns'])})` | {r['childCount']} | {r['parentCount']} | `{', '.join(r['parentColumns'])}` | UPDATE {a['update']}; DELETE {a['delete']} |")
cardinality_note='''These are **actual database cardinalities**, derived from child PK/UQ columns and nullability, not observed occupancy. A FK does not force a parent to have one or more children. Inquiry/quote/JO/delivery item sets, receipt photos and ten stage instances need coordinated later writers before an operational workflow may be accepted. No placeholder children were created to imitate those requirements.
'''
diagram=['```mermaid','erDiagram']
for name in design['tables']:
    diagram.append(f'  {name} {{')
    for c in [r for r in data['columns'] if r['table']==name]:
        labels=[]
        for (t,k),rows in groups.items():
            if t==name and any(r['column']==c['column'] for r in rows):
                label={'PRIMARY KEY':'PK','UNIQUE':'UK','FOREIGN KEY':'FK'}.get(types.get((t,k)))
                if label and label not in labels: labels.append(label)
        dtype=c['type'].split('(')[0].replace(' ','_')
        diagram.append(f"    {dtype} {c['column']}" + (' '+','.join(labels) if labels else ''))
    diagram.append('  }')
for r in fk:
    left='o|' if r['parentCount']=='0..1' else '||'
    right='o|' if r['childCount']=='0..1' else 'o{'
    diagram.append(f"  {r['parent']} {left}--{right} {r['child']} : {r['name']}")
diagram.append('```')
actual=(OUT/'actual-show-create-tables.txt').read_text(encoding='utf-8')
definitions=re.findall(r'^(\w+)\t(CREATE TABLE .*?)(?=^\w+\tCREATE TABLE |\Z)',actual,re.M|re.S)
physical='\n\n'.join(f'### {name}\n\n```sql\n{ddl.strip()};\n```' for name,ddl in definitions)
(DOC/'PHASE_2_DATABASE_CORRECTED_ERD.md').write_text('# P2B002 actual corrected physical ERD\n\n'+intro+
    '## Complete physical ERD\n\nThe diagram includes every actual column and FK. Full MySQL types/defaults/checks/indexes are in the server definitions below.\n\n'+
    '\n'.join(diagram)+'\n\n## Relationship cardinalities and referential actions\n\n'+cardinality_note+'\n'+
    '\n'.join(relation_rows)+'\n\n## Actual MySQL table definitions\n\n'+physical+'\n',encoding='utf-8')

dictionary=[]
checks={r['name']:r['clause'] for r in data['checks']}
for name,item in design['tables'].items():
    dictionary.append(f'## {name}\n\n{item["justification"]}\n\n| Column | Actual MySQL type | Nullable | Default / generation | Keys |\n| --- | --- | --- | --- | --- |')
    for c in [r for r in data['columns'] if r['table']==name]:
        keylabels=[]
        for (t,k),rows in groups.items():
            if t==name and any(r['column']==c['column'] for r in rows): keylabels.append(f'{types.get((t,k))}: {k}')
        default=c['default']
        if c['generated']: default='GENERATED: '+c['generated']
        elif 'auto_increment' in c['extra']: default='AUTO_INCREMENT'
        elif default is None: default='NULL' if c['nullable']=='YES' else 'No explicit default'
        dictionary.append(f"| `{c['column']}` | `{c['type']}` | {c['nullable']} | `{default}` | {'; '.join(keylabels) or '—'} |")
    dictionary.append('\nActual CHECKs:')
    for constraint in data['constraints']:
        if constraint['table']==name and constraint['type']=='CHECK':
            dictionary.append(f"\n- `{constraint['name']}` (ENFORCED={constraint['enforced']}): `{checks[constraint['name']]}`")
    dictionary.append('\nActual indexes (including PK/UQ/FK support):')
    for (t,key),rows in indexes.items():
        if t==name: dictionary.append(f"\n- `{key}` ({', '.join(r['column'] for r in rows)}); unique={rows[0]['nonUnique']==0}.")
    dictionary.append('\n')
(DOC/'PHASE_2_DATABASE_DATA_DICTIONARY.md').write_text('# P2B002 actual data dictionary\n\n'+intro+
    'All definitions below come from actual P2B002 metadata. NULL stock and unknown provenance are distinct from verified numeric zero. Monetary totals use DECIMAL(19,2), unit prices/quantities use declared decimal precision, and IDs use unsigned BIGINT. Enum values, generated expressions and exact FK carriers are included in linked actual CREATE definitions. No old dictionary was used as a template.\n\n'+
    '\n'.join(dictionary),encoding='utf-8')

mapping=['| Revised entity / extension | Actual table | Basis and outcome |','| --- | --- | --- |']
for name,item in design['tables'].items():
    kind='workflow extension' if name in extensions else ('revised reference' if name in refs else 'revised main entity')
    mapping.append(f'| {kind}: `{name}` | `{name}` | {item["justification"]} Present; columns/types/null/defaults and declared relationships verified. |')
resolution=[]
for name,item in design['tables'].items():
    for attr,destination in item['attributeResolution'].items():
        resolution.append(f'| `{name}.{attr}` | {destination} |')
pending='''## Unresolved decisions and requirements not claimed implemented

1. **Ten stage names/order:** the schema reserves unique positions 1–10; no definitions/history exist. Do not invent the tenth name. Exactly ten definitions/instances and sequential transition/reversion transactions need approved reference values and authorized writers.
2. **Receipt allocation:** optional, nonunique receipt linkage follows the unresolved revised cardinality. No one-receipt-one-payment, allocation cap, split policy or inferred transfer is imposed. Manual review authorization, proof completeness and financial transaction atomicity remain required. Separate equal-value payments remain distinct; photos never become money.
3. **Invoice issuer/chronology:** scope wording varies between Sales and Accounting. Actual PO review use cases place invoice before payment/JO. Invoice owns only PO; JO/client derive. Schema actor FKs do not decide or grant issuing permissions. No mandatory pre-JO invoice FK cycle or JO invoice-creation switch was implemented.
4. **Cost estimate selection:** revised text leaves one current versus multiple historic estimates open. The item FK is nonunique to retain history; no unapproved current-estimate uniqueness or approval selection is invented.
5. **Numbering:** quotation_no and po_no uniqueness follow the revised ERD. Printed revision numbering and the distinction between a system PO number and customer-supplied reference need approved formats/namespaces. No number sequences, sample numbers or legacy quote-reference ownership table were carried over.
6. **Stock units/prices:** unit conversion, BOM recipes, reference prices and any reference populations need actual approval. Raw unit_price means approved costing price and requires approver/time; PDF reference values occupy separate nullable fields. No quantities/prices/materials/BOMs are populated. Source JSON for noncylindrical template fields needs approved template validation, not invented legacy column sets.
7. **Cross-row operational invariants:** physical first observations and same-value sample verification can be represented, but atomic balance+movement+audit writers, stable operation-key generation, concurrency/locking and direct-write privilege boundaries are not implemented by this schema-only task. Parent/child guards exist and are restored, but no multi-session mutation tests or proof of universal bypass prevention is claimed. This is not an activated inventory system.
8. **Historical snapshots and staged creation:** complete specification fields/JSON live on JO items, not a mutable master. Issuance/lock rules, append-before-edit audits, minimum one-or-more child records, correct delivered cumulative quantities, manual receipt review and approved snapshot copying need coordinated future writers. Only actual metadata and empty restoration were verified; no fabricated fixtures were inserted.
9. **Existing approved account/finished-good choices:** one portal account per company and client-specific finished goods remain constrained. Revised optional/multi-account variants are not silently activated. The Client account is a shared-PK user_account subtype: credentials/status are stored once, not copied. Staff-versus-client assignment requires the portal role guards and later authenticated APIs; this task creates no logins or grants.
10. **Status/demand vocabularies and forecast basis:** unspecified statuses remain required VARCHAR fields instead of fictional enum populations. Demand/frequency/average fields are nullable; no period, algorithm, thresholds or forecast values were invented. Future UI/API validation and role-specific reporting stay outside this task.

Application configuration is unchanged. No service/frontend compatibility layer, deployment, procurement, bank gateway, courier integration or next implementation task was started.
'''
omissions='''## Explicit omissions and normalized relationships

- **No revised main/reference entity is missing.** The diagram-only stock_request and stock_request_item are included. All revised attributes are either physical columns or explicitly mapped below; no silent omission is treated as a successful match.
- PO stores accepted quotation only; inquiry/client derive. JO stores PO only; inquiry/client/accepted quote derive. Invoice stores PO only; client and optional future JO derive. Delivery stores JO only; PO/invoice/client derive. Ownership guards validate quote-item inquiry, accepted JO source, same-JO delivery items, shortage stages, receipt client and plan/finished-good ownership without adding copied owner chains.
- Client-user email/password/status/login dates live in the revised user_account identity, inherited by the shared-PK portal subtype. No extra credential/session/module/permission-compatibility tables were added.
- Delivery waybill_no/dr_no/signed-file attributes are normalized into the documented waybill, delivery_receipt and retained signed_delivery_receipt entities. Receipt document_id becomes the specifically required multi-photo junction.
- PO downpayment flags/amounts/confirmation dates derive from accepted quote and actual approved payment facts. No independent mutable confirmation flag, inferred allocation, fabricated approval time or duplicate financial record is stored.
- No old shipment, per-product JO header, combined payment/payment-file, split movement, urgent, migration-history, legacy catalog/specification-master, import-review, company-settings, document-sequence, broad lookup or report tables were reproduced for compatibility.
- No payment-term lookup, automatic supplier purchasing, pricing import, BOM template population, courier integration or reporting fact duplication was invented. Plain terms/supplier text are attributes.

The rejected build remains at its original SQL/evidence paths. Byte-preserved copies of its SQL, execution journal and four reports are in [rejected-P2B001](../database/phase2-execution/P2B002-2026-11-22/rejected-P2B001); [fingerprints](../database/phase2-execution/P2B002-2026-11-22/preserved-P2B001-fingerprints.json) record provenance. These are historical artifacts, not inputs or expected outputs for P2B002.
'''
mapping_report=('# P2B002 entity and relationship implementation verification\n\n'+intro+
    '## Entity-by-entity implementation\n\n'+'\n'.join(mapping)+
    '\n\n## Every normalized/omitted revised attribute\n\n| Revised attribute | Actual resolution / reason |\n| --- | --- |\n'+'\n'.join(resolution)+
    '\n\n## Relationship-by-relationship evidence\n\n'+cardinality_note+'\n'+'\n'.join(relation_rows)+'\n\n'+omissions+'\n'+pending)
(DOC/'PHASE_2_DATABASE_ERD_CORRECTION_REPORT.md').write_text(mapping_report,encoding='utf-8')

report=f'''# P2B002 greenfield rebuild — actual execution report

{intro}
## Actual target, rebuild and quiescence

- Database `enterflow_phase2_db`; container `enterflow-phase2-mysql`; host `127.0.0.1`; published port `62286`; MySQL `8.4.13`.
- Server UUID `{run['identityAfter']['uuid']}`; container ID `2acac2d1b6069b6ed30a95b69eb582bd68ef9f365bc092f46530306f34a9eb73`; persistent volume `enterflow-phase2-data`. Exact image, mount, state, endpoint and identity were checked immediately before rebuild.
- Fresh exact COUNT(*) showed all **{run['beforeTableCount']} rejected-build tables empty** before DROP. This is pre-rebuild preservation evidence, not the new expected inventory. [Before-rebuild metadata](../database/phase2-execution/P2B002-2026-11-22/before-rebuild-metadata.json) is retained.
- No other target database sessions and no established application TCP connections to port 62286 were observed. Existing application configuration still selects the excluded shared database; it was only read, never connected to or modified. No application was stopped or switched.
- Only this explicitly authorized empty target was dropped/recreated. Old SQL was not restored, cloned, executed or used to manufacture prerequisites. The new bootstrap was authored independently from revised entities and requirements. DDL implicitly commits; no fake whole-DDL transaction or blanket rerun was used.
- Rebuild execution: `{run['startedAt']}` through `{run['completedAt']}`. New bootstrap SHA-256 `{run['bootstrap']['sha256']}`. Applied once, DDL exit code `{run['ddlExitCode']}`; all expected objects and attributes verified, no partial DDL.

## Design fidelity, not a count-based acceptance claim

The [entity-by-entity mapping and relationship report](PHASE_2_DATABASE_ERD_CORRECTION_REPORT.md) accounts for all revised main/reference entities, every mapped/normalized attribute, all actual FK carriers/cardinalities and the six justified extensions. The [physical ERD](PHASE_2_DATABASE_CORRECTED_ERD.md) includes actual server definitions, every column, key and FK; the [dictionary](PHASE_2_DATABASE_DATA_DICTIONARY.md) records actual types/null/defaults/checks/indexes. None uses the rejected dictionary as a template. The literal authoring source has no old schema/candidate imports and derives its final table set from revised entity definitions, never a fixed target count.

Verification compares exact table and column **sets**, every type/null/default, PK carrier, FK parent/child tuple, unique constraint carrier, declared index columns, enforced CHECK inventory and referential action against that fresh design. Actual CHECK clauses and normalized generated expressions are retained; generated expression token order is reconciled against authored SQL. All ownership/history trigger definitions were read back. This is structural verification, not proof of successful live business writes or permission enforcement under concurrency.

## Failures and warnings

The first preflight stopped before DDL on a JSON parser error caused by MySQL deprecation warning **1287** from INFORMATION_SCHEMA.PROCESSLIST. [The stopped preflight journal](../database/phase2-execution/P2B002-2026-11-22/preflight-attempt-01.json) is retained (`ddlStarted=false`). The executor switched to the supported performance_schema.processlist and repeated target/emptiness/quiescence checks. This was a controlled retry of preflight, **not** a replay of partial schema creation.

The actual bootstrap output contains **zero warnings**. The backup restoration emitted **18 nonfatal code-1681 integer-display-width deprecation warnings** from MySQL's dumped BOOLEAN/TINYINT(1) definitions. Restore exit status was successful, and its complete actual metadata matches the source target. [Bootstrap output](../database/phase2-execution/P2B002-2026-11-22/bootstrap-output.txt) and [restore output](../database/phase2-execution/P2B002-2026-11-22/restore-output.txt) retain the results. No DDL statement failed or was skipped; no destructive operation was repeated after partial execution.

## Fresh backup and separate restoration — actual results

Backup was created **only after corrected-target verification passed**: [P2B002_verified_empty_schema.sql](../database/phase2-execution/P2B002-2026-11-22/P2B002_verified_empty_schema.sql), **{run['backup']['bytes']:,} bytes**, SHA-256 `{run['backup']['sha256']}`. It is a new target-only mysqldump, containing the corrected tables/triggers and zero INSERT records, with no CREATE DATABASE, DROP DATABASE or USE statements. No existing backup was opened or changed.

A **new**, previously nonexistent empty schema `{run['restoreDatabase']}` was created in the same explicitly isolated Phase 2 container/volume for the required separate-target restoration. No other pre-existing database, container or volume was accessed or changed. This new verification schema is separate from the corrected database and retained for review. Restoration used the fresh backup, not a copied schema or old backup, and never overwrote the corrected target.

[Restoration metadata](../database/phase2-execution/P2B002-2026-11-22/restore-metadata.json) exactly matches corrected-target [metadata](../database/phase2-execution/P2B002-2026-11-22/after-metadata.json), including columns, constraints/check clauses, indexes, FK actions and trigger bodies/order. Both have {v['tables']} tables and exact zero row counts. Dump restoration's session-local settings do not change constraints or foreign-key behavior on the corrected database. Restoring an empty schema is proven; this is not an assertion that future populated business-data recovery has been exercised.

## Database Change Report

**Newly designed:** revised entities and documented extensions, with normalized ownership, shared account identity, historical snapshots, unknown-safe stock, separate proof/money and delivery documents. **Actually executed:** dropped/recreated the verified empty rejected target; applied new P2B002; created {v['tables']} tables, {v['columns']} columns, {v['foreignKeys']} FKs, {v['uniqueConstraints']} UQs, {v['enforcedChecks']} enforced CHECKs and {v['triggers']} guard/history triggers; zero data imported or seeded. Created the post-verification backup and verified restoration in one new isolated test schema.

**Preserved:** original P2B001 SQL/execution evidence and byte-preserved report copies; all existing uncommitted contributions and `database/phase2-target.local.json`. **Untouched:** Migration 007/008 and protected history; shared enterflow_db/development databases; Task 002; production; pre-existing backups; all other existing containers/volumes; shared Compose; frontend/backend application/configuration files; Q01/Q02 code. No credentials were printed/read from DPAPI, no users/grants were created, no migration-history CLI was used and no unrelated suites/build/browser/lint were run.

**Pending:** the explicit business/reference/transaction/authorization activation decisions below. Actual schema rebuild, required structural verification, fresh backup and separate restoration are complete; application activation is not claimed and no next task started.

{pending}
'''
(DOC/'PHASE_2_DATABASE_MIGRATION_REPORT.md').write_text(report,encoding='utf-8')

# Verify preservation bytes without opening or touching any existing backup.
fingerprints=json.loads((OUT/'preserved-P2B001-fingerprints.json').read_text(encoding='utf-8'))
preserved=[]
for item in fingerprints:
    archive=ROOT/item['archive'].replace('\\','/')
    if hashlib.sha256(archive.read_bytes()).hexdigest()!=item['sha256']:
        raise RuntimeError('Archived P2B001 evidence differs from preserved fingerprint')
    record={'archive':item['archive'],'matchesRecordedFingerprint':True}
    if item['original'] in ('database/phase2-bootstrap/P2B001_corrected_database_bootstrap.sql',
                            'database/phase2-execution/2026-11-22-bootstrap/execution.json'):
        if hashlib.sha256((ROOT/item['original']).read_bytes()).hexdigest()!=item['sha256']:
            raise RuntimeError('Original rejected bootstrap/execution evidence was changed')
        record['originalStillUnchanged']=True
    preserved.append(record)
(OUT/'historical-preservation-verification.json').write_text(json.dumps(preserved,indent=2)+'\n',encoding='utf-8')
print('Updated four current reports from actual P2B002 metadata; P2B001 reports preserved separately.')
