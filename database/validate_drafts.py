"""Offline checks only. No database driver, connection, or SQL execution.

Run: python database/validate_drafts.py
Use --write-docs to refresh SCHEMA.md and STATIC_CHECKS.json after a draft edit.
This validates the project's deliberately small SQL subset, not server syntax.
"""
from pathlib import Path
import ast
import hashlib
import itertools
import json
import re
import sys

ROOT = Path(__file__).resolve().parent
SUFFIX = ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'


def split_sql(text, separator=','):
    result, start, depth, quoted, i = [], 0, 0, False, 0
    while i < len(text):
        char = text[i]
        if char == "'":
            if quoted and i + 1 < len(text) and text[i + 1] == "'":
                i += 2
                continue
            quoted = not quoted
        if not quoted:
            depth += (char == '(') - (char == ')')
            assert depth >= 0, 'Unbalanced parentheses'
            if char == separator and depth == 0:
                result.append(text[start:i].strip())
                start = i + 1
        i += 1
    assert not quoted and depth == 0, 'Unclosed quote or parentheses'
    if text[start:].strip():
        result.append(text[start:].strip())
    return result


def col_list(text):
    return tuple(x.strip() for x in text.split(','))


def main():
    schema, check_names, seeds, files = {}, set(), {}, []
    paths = sorted((ROOT / 'migrations').glob('*.sql')) + sorted((ROOT / 'seeds').glob('*.sql'))
    for path in paths:
        raw = path.read_text(encoding='utf-8')
        assert '/*!' not in raw and '/*M!' not in raw, 'Executable SQL comment'
        sql = re.sub(r'--[^\n]*', '', raw)
        statements = split_sql(sql, ';')
        tables_here = 0
        for statement in statements:
            assert re.match(r'^(SET NAMES |SET time_zone |CREATE TABLE |INSERT INTO |START TRANSACTION$|COMMIT$)', statement), statement[:80]
            assert not re.search(r'\b(?:DROP|TRUNCATE|ALTER|DELETE|REPLACE|GRANT|BLOB|LONGBLOB)\b', statement), 'Disallowed SQL feature'
            if statement.startswith('INSERT INTO'):
                assert re.fullmatch(r'INSERT INTO \w+\s*\([\w, ]+\) VALUES\s*.+', statement, re.S), 'Unrecognized or schema-qualified INSERT'
            if not statement.startswith('CREATE TABLE'):
                continue
            match = re.fullmatch(r'CREATE TABLE (\w+)\s*\((.*)' + re.escape(SUFFIX), statement, re.S)
            assert match, 'Unrecognized table definition / engine / charset'
            name, body = match.groups()
            assert name not in schema, 'Duplicate table ' + name
            table = {'file': path.name, 'columns': {}, 'unique': [], 'indexes': [], 'foreign_keys': [], 'constraints': [], 'checks': {}}
            tables_here += 1
            for entry in split_sql(body):
                entry = re.sub(r'\s+', ' ', entry)
                column = re.match(r'`?(\w+)`? ((?:BIGINT|SMALLINT|INT|VARCHAR|CHAR|DATETIME|DATE|BOOLEAN|DECIMAL|TEXT|ENUM)\b.*)', entry)
                if column:
                    col, definition = column.groups()
                    assert col not in table['columns'], 'Duplicate column'
                    table['columns'][col] = definition
                    if 'PRIMARY KEY' in definition:
                        table['unique'].append((col,))
                    continue
                table['constraints'].append(entry)
                unique = re.fullmatch(r'(?:PRIMARY KEY|UNIQUE KEY \w+)\s*\(([^)]+)\)', entry)
                index = re.fullmatch(r'KEY \w+\s*\(([^)]+)\)', entry)
                foreign = re.fullmatch(r'FOREIGN KEY\s*\(([^)]+)\) REFERENCES (\w+)\(([^)]+)\)', entry)
                check = re.fullmatch(r'CONSTRAINT (\w+) CHECK \((.*)\)', entry)
                assert unique or index or foreign or check, 'Unrecognized constraint: ' + entry
                if unique:
                    table['unique'].append(col_list(unique[1]))
                if index:
                    table['indexes'].append(col_list(index[1]))
                if foreign:
                    table['foreign_keys'].append((col_list(foreign[1]), foreign[2], col_list(foreign[3])))
                if check:
                    assert check[1] not in check_names and len(check[1]) <= 64, 'Duplicate/long CHECK name'
                    check_names.add(check[1])
                    table['checks'][check[1]] = check[2].strip()
            schema[name] = table
            assert table['unique'], 'No primary/unique key'
            for key in table['unique'] + table['indexes']:
                assert set(key) <= table['columns'].keys(), 'Unknown indexed column'
            for child, parent_name, parent_columns in table['foreign_keys']:
                assert parent_name in schema, 'Missing/forward FK parent: ' + parent_name
                parent = schema[parent_name]
                assert parent_columns in parent['unique'], 'Parent key not explicitly unique'
                assert len(child) == len(parent_columns), 'FK arity mismatch'
                for col, parent_col in zip(child, parent_columns):
                    assert col in table['columns'] and parent_col in parent['columns'], 'Unknown FK column'
                    def signature(definition):
                        base = re.match(r'\w+(?:\([^)]*\))?(?: UNSIGNED)?', definition)[0]
                        charset = re.search(r'CHARACTER SET \w+ COLLATE \w+', definition)
                        return base, charset[0] if charset else None
                    assert signature(table['columns'][col]) == signature(parent['columns'][parent_col]), f'FK type/charset mismatch: {name}.{col}'
        for target, names, values in re.findall(r'INSERT INTO (\w+)\s*\(([^)]+)\) VALUES\s*(.*?);', sql, re.S):
            assert target in schema, 'Unknown INSERT target'
            columns = col_list(names)
            assert set(columns) <= schema[target]['columns'].keys(), 'Unknown seed column'
            for value in split_sql(values):
                row = ast.literal_eval(value)
                row = row if isinstance(row, tuple) else (row,)
                assert len(row) == len(columns), 'Seed arity mismatch'
                seeds.setdefault(target, []).append(dict(zip(columns, row)))
        files.append({'file': str(path.relative_to(ROOT)).replace('\\', '/'), 'tables': tables_here,
                      'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    for name, rows in seeds.items():
        for key in schema[name]['unique']:
            values = [tuple(row.get(col) for col in key) for row in rows]
            nonnull = [v for v in values if None not in v]
            assert len(set(nonnull)) == len(nonnull), 'Duplicate seed key: ' + name
        for child, parent, parent_columns in schema[name]['foreign_keys']:
            allowed = {tuple(row.get(col) for col in parent_columns) for row in seeds.get(parent, [])}
            for row in rows:
                value = tuple(row.get(col) for col in child)
                assert None in value or value in allowed, 'Unresolved seed FK: ' + name

    # Regression checks for the integrity defects found during Phase 2.
    required = [
        ('order_items', ('order_id', 'client_id'), 'orders', ('id', 'client_id')),
        ('order_items', ('specification_id', 'client_id'), 'product_specifications', ('id', 'client_id')),
        ('quotations', ('reference', 'order_id'), 'quotation_references', ('reference', 'order_id')),
        ('quotation_lines', ('order_item_id', 'order_id'), 'order_items', ('id', 'order_id')),
        ('quotation_costing', ('order_item_id', 'order_id'), 'order_items', ('id', 'order_id')),
        ('purchase_orders', ('accepted_quotation_id', 'order_id'), 'quotations', ('id', 'order_id')),
        ('job_orders', ('order_item_id', 'order_id', 'client_id'), 'order_items', ('id', 'order_id', 'client_id')),
        ('job_orders', ('specification_id', 'client_id'), 'product_specifications', ('id', 'client_id')),
        ('finished_goods', ('specification_id', 'client_id'), 'product_specifications', ('id', 'client_id')),
        ('finished_good_order_items', ('finished_good_id', 'client_id'), 'finished_goods', ('id', 'client_id')),
        ('finished_good_order_items', ('order_item_id', 'client_id'), 'order_items', ('id', 'client_id')),
        ('finished_good_movements', ('finished_good_id', 'client_id'), 'finished_goods', ('id', 'client_id')),
        ('finished_good_movements', ('job_order_id', 'client_id'), 'job_orders', ('id', 'client_id')),
        ('stock_responses', ('stock_request_id', 'order_id'), 'stock_requests', ('id', 'order_id')),
        ('quotation_stock_responses', ('quotation_id', 'order_id'), 'quotations', ('id', 'order_id')),
        ('quotation_stock_responses', ('stock_response_id', 'order_id'), 'stock_responses', ('id', 'order_id')),
        ('shipments', ('job_order_id', 'order_id'), 'job_orders', ('id', 'order_id')),
        ('delivery_receipts', ('shipment_id', 'order_id'), 'shipments', ('id', 'order_id')),
        ('signed_delivery_receipts', ('delivery_receipt_id', 'order_id'), 'delivery_receipts', ('id', 'order_id')),
        ('invoice_delivery_receipts', ('invoice_id', 'order_id'), 'invoices', ('id', 'order_id')),
        ('invoice_delivery_receipts', ('signed_delivery_receipt_id', 'order_id', 'accepted_slot'), 'signed_delivery_receipts', ('id', 'order_id', 'accepted_slot')),
        ('payments', ('invoice_id', 'order_id'), 'invoices', ('id', 'order_id')),
        ('orders', ('reorder_source_id', 'client_id'), 'orders', ('id', 'client_id')),
        ('notifications', ('order_id', 'client_id'), 'orders', ('id', 'client_id')),
    ]
    for name, child, parent, parent_columns in required:
        assert (child, parent, parent_columns) in schema[name]['foreign_keys'], 'Missing ownership guard: ' + name
        for col in child:
            if col in ('order_id', 'client_id') and name != 'notifications':
                assert 'NOT NULL' in schema[name]['columns'][col], 'Nullable ownership bypass'
    assert ('delivery_receipt_id', 'accepted_slot') in schema['signed_delivery_receipts']['unique']
    assert 'NOT NULL DEFAULT 1' in schema['invoice_delivery_receipts']['columns']['accepted_slot']
    assert schema['invoice_delivery_receipts']['checks']['ck_invoice_receipt_accepted'] == 'accepted_slot = 1'
    assert schema['signed_delivery_receipts']['checks']['ck_signed_dr_state'] == (
        '(received_at IS NULL AND accepted_slot IS NULL) OR '
        '(received_at IS NOT NULL AND discarded_at IS NULL AND accepted_slot IS NOT NULL AND accepted_slot = 1)'
    )
    # Exhaustive small-domain state model, not SQL/server execution.
    valid_states = []
    for received, discarded, slot in itertools.product((False, True), (False, True), (None, 0, 1, 2)):
        allowed = ((not received and slot is None) or
                   (received and not discarded and slot is not None and slot == 1))
        expected = ((not received and slot is None) or
                    (received and not discarded and slot == 1))
        assert allowed == expected
        if allowed:
            valid_states.append([received, discarded, slot])
    assert valid_states == [[False, False, None], [False, True, None], [True, False, 1]]
    inventory = re.findall(r'^\| `(\w+)` \|', (ROOT / 'TABLE_REVIEW.md').read_text(encoding='utf-8'), re.M)
    assert len(inventory) == len(set(inventory)) and set(inventory) == set(schema), 'Table review coverage mismatch'

    report = {'status': 'passed_offline_only', 'tables': len(schema),
              'columns': sum(len(t['columns']) for t in schema.values()),
              'foreign_keys': sum(len(t['foreign_keys']) for t in schema.values()),
              'named_checks': len(check_names), 'ownership_guard_regressions': len(required),
              'receipt_states': valid_states, 'seed_rows': {t: len(r) for t, r in seeds.items()}, 'files': files,
              'limits': 'No SQL parser, database connection, engine enforcement or concurrency test.'}
    if '--write-docs' in sys.argv:
        (ROOT / 'STATIC_CHECKS.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
        previous = (ROOT / 'SCHEMA.md').read_text(encoding='utf-8')
        introduction = previous.split('## Tables and columns')[0]
        # Keep overview prose/diagram, regenerate every definition from the current drafts.
        doc = introduction + '## Tables and columns\n\n'
        for name, table in schema.items():
            doc += f'### `{name}`\n\nSource: `migrations/{table["file"]}`\n\n| Column | Definition |\n| --- | --- |\n'
            doc += ''.join(f'| `{col}` | `{definition}` |\n' for col, definition in table['columns'].items())
            if table['constraints']:
                doc += '\nKeys, relationships, indexes and checks:\n\n'
                doc += '\n'.join('- `' + constraint + '`' for constraint in table['constraints']) + '\n'
            doc += '\n'
        doc += '## Seed counts\n\n| Table | Rows |\n| --- | --- |\n'
        doc += ''.join(f'| `{name}` | {len(rows)} |\n' for name, rows in seeds.items())
        doc += '\nNo accounts, clients, bank details, balances or operational records are seeded.\n'
        (ROOT / 'SCHEMA.md').write_text(doc, encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
