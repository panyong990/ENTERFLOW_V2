"""XAMPP validation, restricted to enterflow_test_db. Never drops a database.

The prepare mode refuses an existing database. Later modes require this run's
successful creation/migration record. SQL drafts are never edited by this script.
Uses the installed CLI, with no third-party drivers or stored credentials.
"""
from pathlib import Path
from collections import Counter, defaultdict
from decimal import Decimal
import ast
import hashlib
import json
import re
import subprocess
import sys

from validate_drafts import split_sql, col_list

ROOT = Path(__file__).resolve().parent
DB = 'enterflow_test_db'
MYSQL = r'C:\xampp\mysql\bin\mysql.exe'
OUT = ROOT / 'validation'
RESULTS = OUT / 'phase3_results.json'
SETUP = "SET SESSION sql_mode='STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'; SET SESSION foreign_key_checks=1; SET SESSION unique_checks=1; SET SESSION check_constraint_checks=1; SET time_zone='+00:00'; SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;\n"


def cli(sql, selected=True, force=False):
    args = [MYSQL, '--no-defaults', '--host=127.0.0.1', '--port=3306', '--user=root',
            '--skip-password', '--batch', '--raw', '--skip-column-names',
            '--default-character-set=utf8mb4', '--show-warnings']
    if selected:
        args.append('--database=' + DB)
    if force:
        args.append('--force')
    return subprocess.run(args, input=sql, capture_output=True, encoding='utf-8', timeout=120)


def query(sql, selected=True):
    result = cli(sql, selected)
    if result.returncode or result.stderr.strip():
        raise RuntimeError(f'CLI query failed: {result.stderr.strip()}')
    return [json.loads(line) for line in result.stdout.splitlines() if line.strip()]


def save(report):
    OUT.mkdir(exist_ok=True)
    RESULTS.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def verify_hashes():
    manifest = json.loads((ROOT / 'STATIC_CHECKS.json').read_text(encoding='utf-8'))
    for entry in manifest['files']:
        assert hashlib.sha256((ROOT / entry['file']).read_bytes()).hexdigest() == entry['sha256'], 'Reviewed hash mismatch: ' + entry['file']
    return manifest


def main_snapshot():
    # Catalog reads only. No direct command selects or writes the main database.
    return query("SELECT JSON_OBJECT('table',TABLE_NAME,'type',TABLE_TYPE,'engine',ENGINE,'collation',TABLE_COLLATION) FROM information_schema.TABLES WHERE TABLE_SCHEMA='enterflow_db' ORDER BY TABLE_NAME;", False)


def prepare():
    manifest = verify_hashes()
    exists = query("SELECT JSON_OBJECT('schema',SCHEMA_NAME) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='enterflow_test_db';", False)
    if exists:
        print('STOP: enterflow_test_db already exists. Nothing was created or applied.')
        raise SystemExit(2)
    assert not RESULTS.exists(), 'Existing validation report; do not overwrite a prior run.'
    env = query("SELECT JSON_OBJECT('version',VERSION(),'version_comment',@@version_comment,'port',@@port,'sql_mode',@@sql_mode,'foreign_key_checks',@@foreign_key_checks+0,'unique_checks',@@unique_checks+0,'check_constraint_checks',@@check_constraint_checks+0,'innodb_page_size',@@innodb_page_size,'character_set_server',@@character_set_server,'collation_server',@@collation_server,'innodb',(SELECT SUPPORT FROM information_schema.ENGINES WHERE ENGINE='InnoDB'));", False)
    assert env[0]['version'].startswith('10.4.32-MariaDB'), 'Unexpected server version'
    assert env[0]['innodb'] in ('YES', 'DEFAULT'), 'InnoDB unavailable'
    report = {'target': DB, 'reviewed_files': manifest['files'], 'environment': env[0],
              'main_catalog_before': main_snapshot(), 'database_created': False,
              'migrations': [], 'status': 'preflight_complete', 'session_settings': SETUP.strip()}
    save(report)
    # No IF NOT EXISTS: a race with another creator must fail, never reuse it.
    result = cli('CREATE DATABASE enterflow_test_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;', False)
    report['create_result'] = {'exit_code': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr}
    if result.returncode or result.stderr.strip():
        report['status'] = 'creation_failed'
        save(report)
        raise RuntimeError('Database creation failed; stop: ' + result.stderr)
    report['database_created'] = True
    save(report)
    selected = query(SETUP + "SELECT JSON_OBJECT('database',DATABASE(),'sql_mode',@@sql_mode,'foreign_key_checks',@@foreign_key_checks+0,'unique_checks',@@unique_checks+0,'check_constraint_checks',@@check_constraint_checks+0);")
    assert selected[0]['database'] == DB
    report['execution_session'] = selected[0]
    for entry in manifest['files']:
        verify_hashes()
        result = cli(SETUP + (ROOT / entry['file']).read_text(encoding='utf-8'))
        item = {'file': entry['file'], 'exit_code': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr}
        report['migrations'].append(item)
        save(report)
        print(entry['file'], 'exit=', result.returncode, 'warnings=', bool(result.stdout.strip()), flush=True)
        if result.returncode or result.stderr.strip():
            report['status'] = 'migration_failed'
            report['main_catalog_after'] = main_snapshot()
            save(report)
            raise RuntimeError('Migration failed. Drafts unchanged. ' + result.stderr)
    report['status'] = 'migrations_and_seed_applied'
    report['main_catalog_after'] = main_snapshot()
    save(report)
    print('Created and seeded enterflow_test_db. Main catalog unchanged:', report['main_catalog_before'] == report['main_catalog_after'])


def load_run():
    verify_hashes()
    report = json.loads(RESULTS.read_text(encoding='utf-8'))
    assert report['target'] == DB and report['database_created']
    assert len(report['migrations']) == 5 and all(m['exit_code'] == 0 and not m['stderr'].strip() for m in report['migrations'])
    assert query("SELECT JSON_OBJECT('database',DATABASE());")[0]['database'] == DB
    return report


def drafts():
    tables, seeds = {}, defaultdict(list)
    for entry in verify_hashes()['files']:
        sql = re.sub(r'--[^\n]*', '', (ROOT / entry['file']).read_text(encoding='utf-8'))
        for name, body in re.findall(r'CREATE TABLE (\w+)\s*\((.*?)\) ENGINE=', sql, re.S):
            table = {'columns': {}, 'indexes': {}, 'fks': [], 'checks': {}}
            for piece in split_sql(body):
                piece = re.sub(r'\s+', ' ', piece)
                column = re.match(r'`?(\w+)`? ((?:BIGINT|SMALLINT|INT|VARCHAR|CHAR|DATETIME|DATE|BOOLEAN|DECIMAL|TEXT|ENUM)\b.*)', piece)
                if column:
                    table['columns'][column[1]] = column[2]
                    if 'PRIMARY KEY' in column[2]:
                        table['indexes']['PRIMARY'] = (True, (column[1],))
                index = re.fullmatch(r'(PRIMARY KEY|UNIQUE KEY (\w+)|KEY (\w+))\s*\(([^)]+)\)', piece)
                if index:
                    key = index[2] or index[3] or 'PRIMARY'
                    table['indexes'][key] = (not bool(index[3]), col_list(index[4]))
                foreign = re.fullmatch(r'FOREIGN KEY\s*\(([^)]+)\) REFERENCES (\w+)\(([^)]+)\)', piece)
                if foreign:
                    table['fks'].append((col_list(foreign[1]), foreign[2], col_list(foreign[3])))
                check = re.fullmatch(r'CONSTRAINT (\w+) CHECK \((.*)\)', piece)
                if check:
                    table['checks'][check[1]] = check[2].strip()
            tables[name] = table
        for name, columns, values in re.findall(r'INSERT INTO (\w+)\s*\(([^)]+)\) VALUES\s*(.*?);', sql, re.S):
            for value in split_sql(values):
                row = ast.literal_eval(value)
                seeds[name].append(dict(zip(col_list(columns), row if isinstance(row, tuple) else (row,))))
    return tables, seeds


def expression_tree(expression):
    tokens = re.findall(r"'(?:''|[^'])*'|>=|<=|<>|!=|[A-Za-z_][\w]*|\d+(?:\.\d+)?|[()+\-=<>]", expression.replace('`', ''))
    tokens = [t if t.startswith("'") else t.lower() for t in tokens]
    tokens = [t for t in tokens if t not in ('_utf8mb4', '_utf8mb3', '_utf8')]
    pos = 0
    def peek():
        return tokens[pos] if pos < len(tokens) else None
    def take(value=None):
        nonlocal pos
        token = peek()
        assert token is not None and (value is None or token == value), (expression, value, token)
        pos += 1
        return token
    def atom():
        if peek() == '(':
            take('('); value = disjunction(); take(')'); return value
        token = take()
        if re.fullmatch(r'\d+(?:\.\d+)?', token):
            return ('number', str(Decimal(token).normalize()))
        return ('value', token)
    def addition():
        value = atom()
        while peek() in ('+', '-'):
            value = (take(), value, atom())
        return value
    def comparison():
        value = addition()
        if peek() == 'between':
            take(); low = addition(); take('and'); return ('between', value, low, addition())
        if peek() == 'is':
            take(); negate = peek() == 'not'
            if negate: take()
            take('null'); return ('is_not_null' if negate else 'is_null', value)
        if peek() in ('=', '<>', '!=', '>', '<', '>=', '<='):
            op = take(); return ('!=' if op == '<>' else op, value, addition())
        return value
    def negation():
        if peek() == 'not':
            take(); return ('not', negation())
        return comparison()
    def conjunction():
        value = negation()
        while peek() == 'and':
            take(); value = ('and', value, negation())
        return value
    def disjunction():
        value = conjunction()
        while peek() == 'or':
            take(); value = ('or', value, conjunction())
        return value
    tree = disjunction()
    assert pos == len(tokens), (expression, tokens[pos:])
    return tree


def metadata():
    scope = 'TABLE_SCHEMA=DATABASE()'
    return {
        'tables': query(f"SELECT JSON_OBJECT('table',TABLE_NAME,'type',TABLE_TYPE,'engine',ENGINE,'collation',TABLE_COLLATION) FROM information_schema.TABLES WHERE {scope} ORDER BY TABLE_NAME;"),
        'columns': query(f"SELECT JSON_OBJECT('table',TABLE_NAME,'column',COLUMN_NAME,'position',ORDINAL_POSITION,'type',COLUMN_TYPE,'nullable',IS_NULLABLE,'default',COLUMN_DEFAULT,'extra',EXTRA,'charset',CHARACTER_SET_NAME,'collation',COLLATION_NAME) FROM information_schema.COLUMNS WHERE {scope} ORDER BY TABLE_NAME,ORDINAL_POSITION;"),
        'indexes': query(f"SELECT JSON_OBJECT('table',TABLE_NAME,'index',INDEX_NAME,'unique',1-NON_UNIQUE,'position',SEQ_IN_INDEX,'column',COLUMN_NAME,'prefix',SUB_PART,'type',INDEX_TYPE,'direction',COLLATION) FROM information_schema.STATISTICS WHERE {scope} ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX;"),
        'foreign_keys': query(f"SELECT JSON_OBJECT('table',k.TABLE_NAME,'name',k.CONSTRAINT_NAME,'column',k.COLUMN_NAME,'position',k.ORDINAL_POSITION,'parent_schema',k.REFERENCED_TABLE_SCHEMA,'parent',k.REFERENCED_TABLE_NAME,'parent_column',k.REFERENCED_COLUMN_NAME,'update_rule',r.UPDATE_RULE,'delete_rule',r.DELETE_RULE) FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON k.CONSTRAINT_SCHEMA=r.CONSTRAINT_SCHEMA AND k.TABLE_NAME=r.TABLE_NAME AND k.CONSTRAINT_NAME=r.CONSTRAINT_NAME WHERE k.TABLE_SCHEMA=DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL ORDER BY k.TABLE_NAME,k.CONSTRAINT_NAME,k.ORDINAL_POSITION;"),
        'checks': query("SELECT JSON_OBJECT('table',TABLE_NAME,'name',CONSTRAINT_NAME,'expression',CHECK_CLAUSE) FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() ORDER BY TABLE_NAME,CONSTRAINT_NAME;"),
    }


def normalize_type(value):
    if value.upper().startswith('ENUM('):
        return 'enum' + value[value.index('('):]
    value = re.sub(r'^(bigint|smallint|int)\(\d+\)', r'\1', value.lower())
    return value


def normalize_default(value):
    if value is None or value == 'NULL': return None
    value = str(value)
    if value.startswith("'"): return ast.literal_eval(value)
    if value.upper() in ('TRUE', 'FALSE'): return Decimal(int(value.upper() == 'TRUE'))
    if re.fullmatch(r'-?\d+(?:\.\d+)?', value): return Decimal(value)
    if re.fullmatch(r'current_timestamp(?:\(\d+\))?', value, re.I):
        return value.lower()
    return value


def counts(tables):
    return {row['table']: row['rows'] for row in query('\n'.join(
        f"SELECT JSON_OBJECT('table','{name}','rows',COUNT(*)) FROM `{name}`;" for name in tables))}


def verify():
    report = load_run()
    expected, seeds = drafts()
    live = metadata()
    diffs = []
    names = {t['table'] for t in live['tables']}
    if names != set(expected): diffs.append('Table-set mismatch')
    for table in live['tables']:
        if (table['type'], table['engine'], table['collation']) != ('BASE TABLE', 'InnoDB', 'utf8mb4_unicode_ci'):
            diffs.append('Table attributes: ' + table['table'])
    column_count = 0
    for name, table in expected.items():
        columns = [c for c in live['columns'] if c['table'] == name]
        if [c['column'] for c in columns] != list(table['columns']): diffs.append('Column order/set: ' + name)
        for column in columns:
            definition = table['columns'][column['column']]
            rawtype = re.match(r'\w+(?:\([^)]*\))?(?: UNSIGNED)?', definition)[0]
            desiredtype = 'tinyint(1)' if rawtype == 'BOOLEAN' else normalize_type(rawtype)
            if normalize_type(column['type']) != desiredtype: diffs.append(f'Type: {name}.{column["column"]}')
            nullable = 'NO' if 'NOT NULL' in definition or 'PRIMARY KEY' in definition else 'YES'
            if column['nullable'] != nullable: diffs.append(f'Nullability: {name}.{column["column"]}')
            default = re.search(r"\bDEFAULT\s+(CURRENT_TIMESTAMP(?:\(\d+\))?|TRUE|FALSE|'(?:''|[^'])*'|[\d.]+)", definition)
            if normalize_default(column['default']) != normalize_default(default[1] if default else None):
                diffs.append(f'Default: {name}.{column["column"]}: {column["default"]}')
            for attr in ('AUTO_INCREMENT', 'ON UPDATE CURRENT_TIMESTAMP(3)'):
                if (attr in definition) != (attr.lower() in column['extra'].lower()): diffs.append('Extra: ' + name + '.' + column['column'])
            if rawtype.startswith(('VARCHAR', 'CHAR', 'TEXT', 'ENUM')):
                charset = re.search(r'CHARACTER SET (\w+) COLLATE (\w+)', definition)
                desired = (charset[1], charset[2]) if charset else ('utf8mb4', 'utf8mb4_unicode_ci')
                if (column['charset'], column['collation']) != desired: diffs.append('Charset/collation: ' + name + '.' + column['column'])
            column_count += 1
    unique_count = 0
    implicit_indexes = []
    for name, table in expected.items():
        indexes = defaultdict(list)
        for row in live['indexes']:
            if row['table'] == name: indexes[row['index']].append(row)
        liveunique = {key: tuple(r['column'] for r in rows) for key, rows in indexes.items() if rows[0]['unique']}
        expectedunique = {key: value[1] for key, value in table['indexes'].items() if value[0]}
        if liveunique != expectedunique: diffs.append('Unique/primary keys: ' + name)
        unique_count += len(liveunique)
        for key, (unique, cols) in table['indexes'].items():
            rows = indexes.get(key, [])
            if tuple(r['column'] for r in rows) != cols or any(bool(r['unique']) != unique or r['type'] != 'BTREE' or r['prefix'] is not None or r['direction'] != 'A' for r in rows):
                diffs.append('Declared index: ' + name + '.' + key)
        for key, rows in indexes.items():
            if key not in table['indexes']:
                cols = tuple(r['column'] for r in rows)
                if rows[0]['unique'] or not any(cols[:len(child)] == child for child, _, _ in table['fks']):
                    diffs.append('Unexpected non-FK index: ' + name + '.' + key)
                implicit_indexes.append(name + '.' + key)
    fkcount = 0
    for name, table in expected.items():
        groups = defaultdict(list)
        for row in live['foreign_keys']:
            if row['table'] == name: groups[row['name']].append(row)
        signatures = []
        for key, rows in groups.items():
            signatures.append((tuple(r['column'] for r in rows), rows[0]['parent'], tuple(r['parent_column'] for r in rows)))
            if any(r['parent_schema'] != DB or r['update_rule'] != 'RESTRICT' or r['delete_rule'] != 'RESTRICT' for r in rows):
                diffs.append('FK scope/rules: ' + name + '.' + key)
        if Counter(signatures) != Counter(table['fks']): diffs.append('FK definitions: ' + name)
        fkcount += len(groups)
    expectedchecks = {(name, key): expression_tree(expr) for name, t in expected.items() for key, expr in t['checks'].items()}
    actualchecks = {(r['table'], r['name']): expression_tree(r['expression']) for r in live['checks']}
    if actualchecks != expectedchecks: diffs.append('CHECK expression/name mismatch')
    seed_differences = []
    for name, rows in seeds.items():
        keys = list(rows[0])
        pairs = ','.join(f"'{key}',`{key}`" for key in keys)
        actual = query(f'SELECT JSON_OBJECT({pairs}) FROM `{name}`;')
        canonical = lambda rs: Counter(json.dumps(r, sort_keys=True) for r in rs)
        if canonical(actual) != canonical(rows): seed_differences.append(name)
    rowcounts = counts(expected)
    if any(n != len(seeds.get(name, [])) for name, n in rowcounts.items()): diffs.append('Unexpected data outside seeds')
    orphan_results = []
    for name, table in expected.items():
        for child, parent, pcols in table['fks']:
            notnull = ' AND '.join(f'c.`{col}` IS NOT NULL' for col in child)
            join = ' AND '.join(f'p.`{pc}`=c.`{cc}`' for cc, pc in zip(child, pcols))
            result = query(f"SELECT JSON_OBJECT('orphans',COUNT(*)) FROM `{name}` c WHERE {notnull} AND NOT EXISTS (SELECT 1 FROM `{parent}` p WHERE {join});")[0]
            orphan_results.append({'table': name, 'columns': list(child), **result})
    if any(r['orphans'] for r in orphan_results): diffs.append('Orphan records found')
    if report.get('verification'):
        report.setdefault('verification_history', []).append(report['verification'])
    report['verification'] = {'tables': len(names), 'columns': column_count, 'foreign_keys': fkcount,
        'primary_and_unique_constraints': unique_count, 'named_checks': len(live['checks']),
        'metadata_differences': diffs, 'seed_differences': seed_differences, 'row_counts': rowcounts,
        'implicit_fk_indexes': implicit_indexes, 'orphan_checks': orphan_results}
    report['main_catalog_after'] = main_snapshot()
    passed_tests = report.get('integrity_tests') and all(c['passed'] for c in report['integrity_tests']['cases'])
    report['status'] = ('local_validation_passed' if passed_tests else 'schema_and_seed_verified') if not diffs and not seed_differences else 'verification_failed'
    (OUT / 'phase3_metadata.json').write_text(json.dumps(live, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    save(report)
    print(json.dumps({k: v for k, v in report['verification'].items() if k not in ('row_counts', 'implicit_fk_indexes', 'orphan_checks')}, indent=2))
    assert not diffs and not seed_differences, 'Metadata or seed differences; drafts were not changed.'


def integrity_tests():
    report = load_run()
    assert report.get('verification', {}).get('metadata_differences') == []
    tables, seeds = drafts()
    before = counts(tables)
    assert before == report['verification']['row_counts'], 'Unexpected data before fixtures'
    auto_before = query("SELECT JSON_OBJECT('table',TABLE_NAME,'next',AUTO_INCREMENT) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND AUTO_INCREMENT IS NOT NULL ORDER BY TABLE_NAME;")
    history = report.setdefault('integrity_test_history', [])
    if report.get('integrity_tests'):
        history.append(report['integrity_tests'])
    attempt = len(history) + 1
    lines = [SETUP.strip(), 'START TRANSACTION;']
    cases, setup_lines = [], []
    def emit(sql):
        assert '\n' not in sql
        lines.append(sql.rstrip(';') + ';')
        return len(lines)
    def literal(value):
        if value is None: return 'NULL'
        if isinstance(value, (int, float)): return str(value)
        return "'" + value.replace("'", "''") + "'"
    def insert(table, **values):
        sql = f"INSERT INTO `{table}` ({','.join('`'+key+'`' for key in values)}) VALUES ({','.join(literal(v) for v in values.values())})"
        setup_lines.append(emit(sql))
    def test(label, sql, code=None, check=None):
        emit('SAVEPOINT phase3_case')
        line = emit(sql)
        cases.append({'label': label, 'line': line, 'expected_error': code, 'check': check})
        emit('ROLLBACK TO SAVEPOINT phase3_case')
        emit('RELEASE SAVEPOINT phase3_case')

    insert('clients', id=1001, company_name='T3 Client A — 測試')
    insert('clients', id=1002, company_name='T3 Client B')
    insert('users', id=1001, role_code='admin', account_type='employee', display_name='Phase3 Fixture', email='phase3-staff@example.invalid', username='phase3-staff', password_hash='fixture-only-not-a-real-credential')
    insert('users', id=1002, role_code='client', account_type='client', client_id=1001, display_name='Phase3 Client', email='phase3-client@example.invalid', username='phase3-client', password_hash='fixture-only-not-a-real-credential')
    for identifier, client in ((1001, 1001), (1002, 1002)):
        insert('product_specifications', id=identifier, client_id=client, filter_type_code='AIRFIL', filter_name='Phase3 Filter')
    for identifier, client, spec in ((1001, 1001, 1001), (1002, 1001, 1001), (1003, 1002, 1002)):
        insert('orders', id=identifier, reference=f'T3-ORDER-{identifier}', client_id=client, contact_person='Fixture Contact', stage_code='inquiry', payment_term_code='NET15', created_by=1001)
        insert('order_items', id=identifier, order_id=identifier, client_id=client, line_number=1, specification_id=spec, quantity=10)
        insert('quotation_references', reference=f'T3-Q-{identifier}', order_id=identifier)
        insert('quotations', id=identifier, order_id=identifier, reference=f'T3-Q-{identifier}', revision_number=1, issued_on='2030-01-01', valid_until='2030-02-01', payment_term_code='NET15', time_of_delivery='Fixture only', place_of_delivery='Fixture only', total_amount=100, prepared_by=1001)
        insert('job_orders', id=identifier, reference=f'T3-JO-{identifier}', order_id=identifier, client_id=client, order_item_id=identifier, specification_id=spec, quantity=10, production_due_date='2030-02-01', created_by=1001)
        insert('shipments', id=identifier, job_order_id=identifier, order_id=identifier, delivery_method_code='Client Pick-up', updated_by=1001)
        insert('delivery_receipts', id=identifier, shipment_id=identifier, order_id=identifier, reference=f'T3-DR-{identifier}', generated_by=1001)
        insert('invoices', id=identifier, order_id=identifier, reference=f'T3-SI-{identifier}', issued_on='2030-01-01', amount=100, payment_term_code='NET15', created_by=1001)
    # An unoccupied JO/shipment permits wrong-order tests without a preceding
    # one-shipment-per-JO or one-DR-per-shipment uniqueness collision.
    insert('job_orders', id=1004, reference='T3-JO-1004', order_id=1002, client_id=1001, order_item_id=1002, specification_id=1001, quantity=10, production_due_date='2030-02-01', created_by=1001)
    insert('shipments', id=1004, job_order_id=1004, order_id=1002, delivery_method_code='Client Pick-up', updated_by=1001)
    insert('job_orders', id=1005, reference='T3-JO-1005', order_id=1002, client_id=1001, order_item_id=1002, specification_id=1001, quantity=10, production_due_date='2030-02-01', created_by=1001)
    insert('quotation_references', reference='T3-Q-EXTRA', order_id=1001)
    insert('materials', id=1001, name='Phase3 material', category_code='filter_media', unit_code='pcs', unit_price='1.2345', quantity_on_hand=90)
    config = dict(labor_cost=1, markup_percent=10, discount_percent=0, vat_type='Exclusive', vat_rate=12, include_labor=1, apply_markup=1, apply_vat=1)
    insert('bom_templates', id=1001, name='Phase3 template', filter_type_code='AIRFIL', created_by=1001, **config)
    insert('bom_template_lines', id=1001, template_id=1001, line_number=1, material_id=1001, quantity_per_filter=1)
    insert('quotation_costing', id=1001, quotation_id=1001, order_id=1001, order_item_id=1001, calculated_unit_price=10, **config)
    insert('quotation_lines', id=1001, quotation_id=1001, order_id=1001, order_item_id=1001, line_number=1, description='Fixture line', quantity=10, unit_label='pcs', unit_price=10)
    insert('quotation_bom_lines', id=1001, costing_id=1001, line_number=1, material_id=1001, material_name_snapshot='Phase3 material', unit_snapshot='pcs', unit_price_snapshot=1, quantity_per_filter=1)
    insert('quotation_discounts', quotation_id=1001, line_number=1, label='Fixture discount', percent=5)
    insert('quotation_addons', id=1001, quotation_id=1001, kind='packaging', label='Fixture packaging', quantity=1, unit_price=1, include_in_unit_price=0)
    insert('purchase_orders', id=1001, order_id=1001, accepted_quotation_id=1001, reference='T3-PO-1001', uploaded_by=1001)
    insert('replacement_requests', id=1001, order_id=1001, reason='Fixture only', defect_description='Fixture only', quantity=1, requested_by=1001)
    insert('job_bom_lines', id=1001, job_order_id=1001, line_number=1, material_id=1001, material_name_snapshot='Phase3 material', unit_snapshot='pcs', unit_price_snapshot=1, quantity_per_filter=1)
    insert('material_movements', id=1001, material_id=1001, job_order_id=1001, kind='jo_deduction', quantity_delta=-10, quantity_before=100, quantity_after=90, reason='Fixture only', idempotency_key='T3-MOVE-1001', performed_by=1001)
    for identifier, client in ((1001, 1001), (1002, 1002)):
        insert('finished_goods', id=identifier, client_id=client, item_code=f'T3-FG-{identifier}', enterfil_part_number=f'T3-PN-{identifier}', specification_id=identifier, updated_by=1001)
    insert('finished_good_order_items', finished_good_id=1001, order_item_id=1001, client_id=1001)
    insert('finished_good_movements', id=1001, finished_good_id=1001, client_id=1001, job_order_id=1001, quantity_before=1, quantity_after=2, reason='Fixture only', performed_by=1001)
    for identifier in (1001, 1002):
        insert('stock_requests', id=identifier, reference=f'T3-STOCK-{identifier}', order_id=identifier, requested_by=1001)
        insert('stock_request_lines', id=identifier, stock_request_id=identifier, material_id=1001, material_name_snapshot='Phase3 material', unit_snapshot='pcs', required_quantity=10, stock_at_request=90, shortage_at_request=0)
        insert('stock_responses', id=identifier, stock_request_id=identifier, order_id=identifier, kind='initial', responded_by=1001)
        insert('stock_response_lines', stock_response_id=identifier, stock_request_line_id=identifier, stock_request_id=identifier, current_quantity=90, shortage_quantity=0, status='sufficient')
    insert('quotation_stock_responses', quotation_id=1001, stock_response_id=1001, order_id=1001)
    for identifier in range(1001, 1013):
        insert('files', id=identifier, original_filename=f'phase3-{identifier}.pdf', mime_type='application/pdf', size_bytes=1, bucket='phase3-fixture-no-real-bucket', object_path=f'phase3/{identifier}.pdf', uploaded_by=1001, state='available')
    for identifier, dr, order, file, accepted, discarded in ((1001,1001,1001,1001,True,False), (1002,1002,1002,1002,True,False), (1003,1001,1001,1003,False,False), (1004,1001,1001,1004,False,True), (1005,1001,1001,1005,False,False), (1006,1003,1003,1006,True,False)):
        insert('signed_delivery_receipts', id=identifier, delivery_receipt_id=dr, order_id=order, file_id=file, submitted_by=1001, received_at='2030-01-02 00:00:00.000' if accepted else None, accepted_slot=1 if accepted else None, discarded_at='2030-01-02 00:00:00.000' if discarded else None)
    insert('invoice_delivery_receipts', invoice_id=1001, signed_delivery_receipt_id=1001, order_id=1001)
    insert('payments', id=1001, order_id=1001, invoice_id=1001, payment_type='DOWNPAYMENT', submitted_amount=10, paid_on='2030-01-01', submitted_by=1001, idempotency_key='T3-PAY-1001')
    insert('company_settings', id=1, company_name='Phase3 fixture only', updated_by=1001)
    insert('notifications', id=1001, department='system', title='Phase3 fixture', body='Fixture only', order_id=1001, client_id=1001)

    # Each named CHECK is exercised by a violating statement and identified in
    # the actual server error. Every case rolls back to a fixture savepoint.
    check_cases = [
        ('ck_user_identity', "UPDATE users SET account_type='client' WHERE id=1001"),
        ('ck_material_values', 'UPDATE materials SET unit_price=-1 WHERE id=1001'),
        ('ck_template_cost', 'UPDATE bom_templates SET labor_cost=-1 WHERE id=1001'),
        ('ck_template_qty', 'UPDATE bom_template_lines SET quantity_per_filter=0 WHERE id=1001'),
        ('ck_order_item_qty', 'UPDATE order_items SET quantity=9 WHERE id=1001'),
        ('ck_quote_amounts', 'UPDATE quotations SET total_amount=-1 WHERE id=1001'),
        ('ck_quote_dates', "UPDATE quotations SET valid_until='2029-12-31' WHERE id=1001"),
        ('ck_quote_line_values', 'UPDATE quotation_lines SET quantity=0 WHERE id=1001'),
        ('ck_costing_values', 'UPDATE quotation_costing SET labor_cost=-1 WHERE id=1001'),
        ('ck_quote_bom_values', 'UPDATE quotation_bom_lines SET quantity_per_filter=0 WHERE id=1001'),
        ('ck_quote_discount', 'UPDATE quotation_discounts SET percent=101 WHERE quotation_id=1001'),
        ('ck_addon_values', 'UPDATE quotation_addons SET quantity=0 WHERE id=1001'),
        ('ck_production_position', "INSERT INTO production_stages(position,label) VALUES(99,'Fixture invalid')"),
        ('ck_replacement_qty', 'UPDATE replacement_requests SET quantity=0 WHERE id=1001'),
        ('ck_jo_values', 'UPDATE job_orders SET current_stage_cursor=10 WHERE id=1001'),
        ('ck_job_bom_values', 'UPDATE job_bom_lines SET quantity_per_filter=0 WHERE id=1001'),
        ('ck_material_movement', 'UPDATE material_movements SET quantity_after=89 WHERE id=1001'),
        ('ck_stock_request_values', 'UPDATE stock_request_lines SET required_quantity=0 WHERE id=1001'),
        ('ck_stock_response_values', 'UPDATE stock_response_lines SET shortage_quantity=-1 WHERE stock_response_id=1001'),
        ('ck_signed_dr_state', "UPDATE signed_delivery_receipts SET received_at='2030-01-02' WHERE id=1003"),
        ('ck_invoice_amount', 'UPDATE invoices SET amount=-1 WHERE id=1001'),
        ('ck_invoice_receipt_accepted', 'UPDATE invoice_delivery_receipts SET accepted_slot=0 WHERE invoice_id=1001'),
        ('ck_payment_amount', 'UPDATE payments SET submitted_amount=0 WHERE id=1001'),
        ('ck_payment_review', "UPDATE payments SET verification_status='verified' WHERE id=1001"),
        ('ck_company_singleton', 'UPDATE company_settings SET id=2 WHERE id=1'),
        ('ck_notification_order_scope', 'UPDATE notifications SET client_id=NULL WHERE id=1001'),
    ]
    assert {name for name, _ in check_cases} == {key for t in tables.values() for key in t['checks']}
    for name, sql in check_cases: test('CHECK ' + name, sql, 4025, name)
    ownership = [
        ('Order item/client', 'INSERT INTO order_items(order_id,client_id,line_number,specification_id,quantity) VALUES(1001,1002,2,1002,10)'),
        ('Order item/specification client', 'UPDATE order_items SET specification_id=1002 WHERE id=1001'),
        ('Quotation/reference owner', "UPDATE quotations SET reference='T3-Q-1002',revision_number=2 WHERE id=1001"),
        ('Quotation line/item order', 'UPDATE quotation_lines SET order_item_id=1002 WHERE id=1001'),
        ('Quotation costing/item order', 'UPDATE quotation_costing SET order_item_id=1002 WHERE id=1001'),
        ('PO/accepted quotation order', 'UPDATE purchase_orders SET accepted_quotation_id=1002 WHERE id=1001'),
        ('JO/item order', 'UPDATE job_orders SET order_item_id=1002 WHERE id=1001'),
        ('JO/specification client', 'UPDATE job_orders SET specification_id=1002 WHERE id=1001'),
        ('Finished good/specification client', 'UPDATE finished_goods SET specification_id=1002 WHERE id=1001'),
        ('Finished-good match/good client', 'UPDATE finished_good_order_items SET finished_good_id=1002 WHERE finished_good_id=1001'),
        ('Finished-good match/item client', 'UPDATE finished_good_order_items SET order_item_id=1003 WHERE finished_good_id=1001'),
        ('Finished movement/good client', 'UPDATE finished_good_movements SET finished_good_id=1002 WHERE id=1001'),
        ('Finished movement/JO client', 'UPDATE finished_good_movements SET job_order_id=1003 WHERE id=1001'),
        ('Stock response/request order', "INSERT INTO stock_responses(stock_request_id,order_id,kind,responded_by) VALUES(1002,1001,'updated',1001)"),
        ('Quote stock/quotation order', 'UPDATE quotation_stock_responses SET quotation_id=1002 WHERE quotation_id=1001'),
        ('Quote stock/response order', 'UPDATE quotation_stock_responses SET stock_response_id=1002 WHERE quotation_id=1001'),
        ('Shipment/JO order', 'UPDATE shipments SET job_order_id=1005 WHERE id=1001'),
        ('DR/shipment order', 'UPDATE delivery_receipts SET shipment_id=1004 WHERE id=1001'),
        ('Signed copy/DR order', 'UPDATE signed_delivery_receipts SET delivery_receipt_id=1002 WHERE id=1003'),
        ('Invoice evidence/invoice order', 'UPDATE invoice_delivery_receipts SET invoice_id=1002 WHERE invoice_id=1001'),
        ('Invoice evidence/signed copy order', 'UPDATE invoice_delivery_receipts SET signed_delivery_receipt_id=1002 WHERE invoice_id=1001'),
        ('Payment/invoice order', 'UPDATE payments SET invoice_id=1002 WHERE id=1001'),
        ('Reorder/client', 'UPDATE orders SET reorder_source_id=1003 WHERE id=1001'),
        ('Notification/order client', 'UPDATE notifications SET client_id=1002 WHERE id=1001'),
        ('JO/replacement order', 'UPDATE job_orders SET replacement_request_id=1001 WHERE id=1002'),
        ('JO/costing order', 'UPDATE job_orders SET costing_id=1001 WHERE id=1002'),
        ('Stock response/material request', 'UPDATE stock_response_lines SET stock_request_line_id=1002 WHERE stock_response_id=1001'),
        ('Invoice evidence/pending receipt', 'UPDATE invoice_delivery_receipts SET signed_delivery_receipt_id=1003 WHERE invoice_id=1001'),
        ('Invoice evidence/discarded receipt', 'UPDATE invoice_delivery_receipts SET signed_delivery_receipt_id=1004 WHERE invoice_id=1001'),
    ]
    for label, sql in ownership: test('FK ' + label, sql, 1452)
    test('FK restrict parent delete', 'DELETE FROM clients WHERE id=1001', 1451)
    test('FK restrict linked receipt unaccept', 'UPDATE signed_delivery_receipts SET received_at=NULL,accepted_slot=NULL WHERE id=1001', 1451)
    unique_cases = [
        ('one accepted signed copy', "UPDATE signed_delivery_receipts SET received_at='2030-01-02',accepted_slot=1 WHERE id=1003"),
        ('signed copy file', 'UPDATE signed_delivery_receipts SET file_id=1001 WHERE id=1003'),
        ('storage bucket/object', "UPDATE files SET object_path='phase3/1001.pdf' WHERE id=1007"),
        ('username', "UPDATE users SET username='phase3-staff' WHERE id=1002"),
        ('email', "UPDATE users SET email='phase3-staff@example.invalid' WHERE id=1002"),
        ('finished item code', "UPDATE finished_goods SET item_code='T3-FG-1001' WHERE id=1002"),
        ('quote reference owner', "INSERT INTO quotation_references(reference,order_id) VALUES('T3-Q-1001',1002)"),
        ('JO reference', "UPDATE job_orders SET reference='T3-JO-1001' WHERE id=1002"),
        ('invoice reference', "UPDATE invoices SET reference='T3-SI-1001' WHERE id=1002"),
        ('material movement idempotency', "INSERT INTO material_movements(material_id,kind,quantity_delta,quantity_before,quantity_after,reason,idempotency_key,performed_by) VALUES(1001,'adjustment',0,90,90,'Fixture duplicate','T3-MOVE-1001',1001)"),
        ('payment idempotency', "INSERT INTO payments(order_id,payment_type,submitted_amount,paid_on,submitted_by,idempotency_key) VALUES(1001,'DOWNPAYMENT',1,'2030-01-01',1001,'T3-PAY-1001')"),
        ('quotation order revision', "INSERT INTO quotations(order_id,reference,revision_number,issued_on,valid_until,payment_term_code,time_of_delivery,place_of_delivery,total_amount,prepared_by) VALUES(1001,'T3-Q-EXTRA',1,'2030-01-01','2030-02-01','NET15','Fixture','Fixture',100,1001)"),
    ]
    for label, sql in unique_cases: test('UNIQUE ' + label, sql, 1062)
    test('Receipt NULL bypass rejected', 'UPDATE signed_delivery_receipts SET accepted_slot=NULL WHERE id=1006', 4025, 'ck_signed_dr_state')
    test('Receipt slot 2 rejected', "UPDATE signed_delivery_receipts SET received_at='2030-01-02',accepted_slot=2 WHERE id=1003", 4025, 'ck_signed_dr_state')
    test('Receipt received+discarded rejected', "UPDATE signed_delivery_receipts SET received_at='2030-01-02',accepted_slot=1 WHERE id=1004", 4025, 'ck_signed_dr_state')
    test('Accepted receipt client/order mismatch rejected', 'UPDATE signed_delivery_receipts SET delivery_receipt_id=1003 WHERE id=1003', 1452)
    test('Valid quotation next revision', "INSERT INTO quotations(order_id,reference,revision_number,issued_on,valid_until,payment_term_code,time_of_delivery,place_of_delivery,total_amount,prepared_by) VALUES(1001,'T3-Q-1001',2,'2030-01-01','2030-02-01','NET15','Fixture','Fixture',100,1001)")
    test('Valid different reference same order', "INSERT INTO quotations(order_id,reference,revision_number,issued_on,valid_until,payment_term_code,time_of_delivery,place_of_delivery,total_amount,prepared_by) VALUES(1001,'T3-Q-EXTRA',2,'2030-01-01','2030-02-01','NET15','Fixture','Fixture',100,1001)")
    test('Valid additional staged receipt', 'INSERT INTO signed_delivery_receipts(delivery_receipt_id,order_id,file_id,submitted_by) VALUES(1001,1001,1007,1001)')
    test('Valid additional discarded receipt', "INSERT INTO signed_delivery_receipts(delivery_receipt_id,order_id,file_id,submitted_by,discarded_at) VALUES(1001,1001,1008,1001,'2030-01-02')")
    test('Valid same-order accepted evidence', 'INSERT INTO invoice_delivery_receipts(invoice_id,signed_delivery_receipt_id,order_id) VALUES(1002,1002,1002)')
    test('Valid pre-invoice downpayment', "INSERT INTO payments(order_id,payment_type,submitted_amount,paid_on,submitted_by,idempotency_key) VALUES(1001,'DOWNPAYMENT',5,'2030-01-01',1001,'T3-PREINVOICE')")
    test('Valid verified payment', "UPDATE payments SET verification_status='verified',verified_amount=10,reviewed_by=1001,reviewed_at='2030-01-02' WHERE id=1001")
    test('Valid same-client reorder', 'UPDATE orders SET reorder_source_id=1002 WHERE id=1001')
    emit("SELECT JSON_OBJECT('fixture_clients',(SELECT COUNT(*) FROM clients),'accepted_drs',(SELECT COUNT(*) FROM signed_delivery_receipts WHERE accepted_slot=1),'pending_copies',(SELECT COUNT(*) FROM signed_delivery_receipts WHERE received_at IS NULL AND discarded_at IS NULL),'unicode_name',(SELECT company_name FROM clients WHERE id=1001),'decimal_price',(SELECT CAST(unit_price AS CHAR) FROM materials WHERE id=1001))")
    emit('ROLLBACK')
    emit("SELECT JSON_OBJECT('rolled_back_clients',(SELECT COUNT(*) FROM clients),'rolled_back_payments',(SELECT COUNT(*) FROM payments))")
    sql = '\n'.join(lines) + '\n'
    prefix = 'phase3_integrity' if attempt == 1 else f'phase3_integrity_attempt{attempt}'
    (OUT / (prefix + '_tests.sql')).write_text(sql, encoding='utf-8')
    # --force is used ONLY here to collect explicitly expected constraint errors.
    # It is never used to apply migrations. Any other error makes validation fail.
    result = cli(sql, force=True)
    (OUT / (prefix + '_stdout.txt')).write_text(result.stdout, encoding='utf-8')
    (OUT / (prefix + '_stderr.txt')).write_text(result.stderr, encoding='utf-8')
    errors = {}
    for line in result.stderr.splitlines():
        m = re.match(r'ERROR (\d+) \([^)]+\) at line (\d+): (.*)', line)
        assert m, 'Unrecognized diagnostic: ' + line
        errors[int(m[2])] = {'code': int(m[1]), 'message': m[3]}
    unexpected = [{'line': line, **error} for line, error in errors.items() if line not in {c['line'] for c in cases}]
    for case in cases:
        error = errors.get(case['line'])
        case['actual_error'] = error
        case['passed'] = ((error is None and case['expected_error'] is None) or
                          (error is not None and error['code'] == case['expected_error'] and
                           (case['check'] is None or case['check'] in error['message'])))
    data = [json.loads(line) for line in result.stdout.splitlines() if line.startswith('{')]
    assert data and data[0]['unicode_name'] == 'T3 Client A — 測試' and data[0]['decimal_price'] == '1.2345'
    after = counts(tables)
    auto_after = query("SELECT JSON_OBJECT('table',TABLE_NAME,'next',AUTO_INCREMENT) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND AUTO_INCREMENT IS NOT NULL ORDER BY TABLE_NAME;")
    report['integrity_tests'] = {'attempt': attempt, 'artifact_prefix': prefix, 'setup_statements': len(setup_lines), 'cases': cases,
        'unexpected_errors': unexpected, 'client_exit_code': result.returncode, 'fixture_observations': data,
        'all_row_counts_restored': before == after, 'row_counts_after': after,
        'auto_increment_before': auto_before, 'auto_increment_after': auto_after,
        'warning_lines': [line for line in result.stdout.splitlines() if line.startswith(('Warning', 'Note'))]}
    report['main_catalog_after'] = main_snapshot()
    report['status'] = 'local_validation_passed' if all(c['passed'] for c in cases) and not unexpected and before == after else 'integrity_test_failure'
    save(report)
    print(json.dumps({'cases': len(cases), 'passed': sum(c['passed'] for c in cases), 'unexpected_errors': unexpected,
                      'failed_cases': [c for c in cases if not c['passed']], 'row_counts_restored': before == after,
                      'fixture_observations': data, 'main_catalog_unchanged': report['main_catalog_before'] == report['main_catalog_after']}, indent=2))
    assert report['status'] == 'local_validation_passed', 'Integrity tests had failures; drafts were not modified.'


if __name__ == '__main__':
    if sys.argv[1:] == ['--prepare']:
        prepare()
    elif sys.argv[1:] == ['--verify']:
        verify()
    elif sys.argv[1:] == ['--test']:
        integrity_tests()
    else:
        raise SystemExit('Use --prepare, --verify, or --test. Existing databases are never overwritten.')
