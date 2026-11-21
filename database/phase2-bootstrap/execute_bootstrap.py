"""Execute the single authorized Phase 2 bootstrap; never import application code.

Hard target guards, inspected empty-schema backup replay, stop-on-error DDL,
and actual metadata/row-count evidence. No automatic recovery or blind rerun.
"""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import hashlib
import json
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
SQL = Path(__file__).with_name('P2B001_corrected_database_bootstrap.sql')
OUT = ROOT / 'database/phase2-execution/2026-11-22-bootstrap'
BACKUP = OUT / 'pre-bootstrap-empty.sql'
JOURNAL = OUT / 'execution.json'
CONTAINER = 'enterflow-phase2-mysql'
DATABASE = 'enterflow_phase2_db'
UUID = '0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8'
CONTAINER_ID = '2acac2d1b6069b6ed30a95b69eb582bd68ef9f365bc092f46530306f34a9eb73'
IMAGE = 'mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902'
state = {'startedAt': datetime.now(timezone(timedelta(hours=8))).isoformat(),
         'container': CONTAINER, 'database': DATABASE, 'host': '127.0.0.1', 'port': 62286,
         'status': 'preflight', 'bootstrapAttempted': False}

def save():
    JOURNAL.write_text(json.dumps(state, indent=2) + '\n', encoding='utf-8')

def docker(args, stdin=None):
    result = subprocess.run(['docker', '--context', 'desktop-linux', *args],
                            input=stdin, text=True, encoding='utf-8', capture_output=True)
    if result.returncode:
        raise RuntimeError(f'Docker/MySQL exit {result.returncode}: {result.stderr.strip()}')
    return result.stdout

def mysql(sql):
    return docker(['exec', '-i', CONTAINER, 'sh', '-c',
                   'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql --protocol=socket '
                   '--user=root --database=enterflow_phase2_db --batch --raw --skip-column-names --show-warnings'], sql)

def rows(sql):
    output = mysql(sql)
    return [json.loads(line) for line in output.splitlines() if line.strip()]

def require(condition, message):
    if not condition:
        raise RuntimeError(message)

def snapshot():
    where = "table_schema=DATABASE()"
    data = {}
    data['tables'] = rows("SELECT JSON_OBJECT('table',table_name,'type',table_type,'engine',engine,'collation',table_collation) FROM information_schema.tables WHERE " + where + ' ORDER BY table_name;')
    data['columns'] = rows("SELECT JSON_OBJECT('table',table_name,'column',column_name,'position',ordinal_position,'type',column_type,'nullable',is_nullable,'default',column_default,'extra',extra,'generated',generation_expression) FROM information_schema.columns WHERE " + where + ' ORDER BY table_name,ordinal_position;')
    data['constraints'] = rows("SELECT JSON_OBJECT('table',table_name,'name',constraint_name,'type',constraint_type,'enforced',enforced) FROM information_schema.table_constraints WHERE " + where + ' ORDER BY table_name,constraint_name;')
    data['keys'] = rows("SELECT JSON_OBJECT('table',table_name,'name',constraint_name,'position',ordinal_position,'column',column_name,'parent',referenced_table_name,'parentColumn',referenced_column_name) FROM information_schema.key_column_usage WHERE " + where + ' ORDER BY table_name,constraint_name,ordinal_position;')
    data['indexes'] = rows("SELECT JSON_OBJECT('table',table_name,'name',index_name,'nonUnique',non_unique,'position',seq_in_index,'column',column_name) FROM information_schema.statistics WHERE " + where + ' ORDER BY table_name,index_name,seq_in_index;')
    data['checks'] = rows("SELECT JSON_OBJECT('name',constraint_name,'clause',check_clause) FROM information_schema.check_constraints WHERE constraint_schema=DATABASE() ORDER BY constraint_name;")
    data['referentialActions'] = rows("SELECT JSON_OBJECT('table',table_name,'name',constraint_name,'update',update_rule,'delete',delete_rule) FROM information_schema.referential_constraints WHERE constraint_schema=DATABASE() ORDER BY table_name,constraint_name;")
    names = [r['table'] for r in data['tables']]
    if names:
        data['rowCounts'] = rows(' UNION ALL '.join(f"SELECT JSON_OBJECT('table','{name}','rows',COUNT(*)) FROM `{name}`" for name in names) + ';')
    else:
        data['rowCounts'] = []
    return data

def verify(source, data):
    definitions = dict(re.findall(r'CREATE TABLE (\w+)\s*\((.*?)\) ENGINE', source, re.S))
    manifest = SQL.with_name('P2B001_tables.txt').read_text(encoding='utf-8').splitlines()
    require(set(definitions) == set(manifest), 'Authored SQL/manifest mismatch')
    require(set(definitions) == {r['table'] for r in data['tables']}, 'Missing or unintended actual tables')
    require(all(r['engine'] == 'InnoDB' for r in data['tables']), 'Unexpected storage engine')
    require(all(r['rows'] == 0 for r in data['rowCounts']), 'Unexpected records: bootstrap must not seed/import')
    actual_keys = {}
    for row in data['keys']:
        actual_keys.setdefault((row['table'], row['name']), []).append(row)
    actual_index = {}
    for row in data['indexes']:
        actual_index.setdefault((row['table'], row['name']), []).append(row)
    actual_checks = {(r['table'], r['name']) for r in data['constraints'] if r['type'] == 'CHECK' and r['enforced'] == 'YES'}
    expected_checks = set()
    expected_fks = set()
    expected_unique = set()
    for table, body in definitions.items():
        primary = re.search(r'PRIMARY KEY\s*\(([^)]+)\)', body)
        if primary:
            primary_columns = [c.strip() for c in primary.group(1).split(',')]
        else:
            inline = re.search(r'^\s*(\w+) [^\n,]*PRIMARY KEY', body, re.M)
            require(inline is not None, f'No authored PK on {table}')
            primary_columns = [inline.group(1)]
        require([r['column'] for r in actual_keys.get((table, 'PRIMARY'), [])] == primary_columns,
                f'Actual PK differs on {table}')
        for unique, name, carrier in re.findall(r'(UNIQUE\s+)?KEY\s+(\w+)\s*\(([^)]+)\)', body):
            columns = [c.strip() for c in carrier.split(',')]
            actual = actual_index.get((table, name), [])
            require([r['column'] for r in actual] == columns, f'Actual index differs: {table}.{name}')
            if unique:
                require(all(r['nonUnique'] == 0 for r in actual), f'Index not unique: {table}.{name}')
                expected_unique.add((table, name))
        for child, parent, carrier in re.findall(r'FOREIGN KEY\s*\(([^)]+)\)\s*REFERENCES\s+(\w+)\s*\(([^)]+)\)', body, re.S):
            expected_fks.add((table, tuple(c.strip() for c in child.split(',')), parent, tuple(c.strip() for c in carrier.split(','))))
        expected_checks.update((table, name) for name in re.findall(r'CONSTRAINT\s+(\w+)\s+CHECK', body))
    # The session-local guard CHECK is excluded: it has no persistent table.
    require(actual_checks == expected_checks, 'Actual enforced CHECK inventory differs')
    actual_fks = set()
    for (table, name), key in actual_keys.items():
        if key[0]['parent'] is not None:
            actual_fks.add((table, tuple(r['column'] for r in key), key[0]['parent'], tuple(r['parentColumn'] for r in key)))
    require(actual_fks == expected_fks, 'Actual FK columns/parents differ from bootstrap')
    actual_unique = {(r['table'],r['name']) for r in data['constraints'] if r['type'] == 'UNIQUE'}
    require(actual_unique == expected_unique, 'Actual unique constraint inventory differs')
    require(all(r['delete'] in ('RESTRICT','NO ACTION') and r['update'] in ('RESTRICT','NO ACTION') for r in data['referentialActions']), 'Unexpected cascade action')
    return {'tables': len(definitions), 'primaryKeys': len(definitions), 'foreignKeys': len(actual_fks),
            'uniqueConstraints': len(actual_unique), 'enforcedChecks': len(actual_checks),
            'indexesIncludingPrimaryAndFkSupporting': len(actual_index),
            'rowsAcrossAllTables': sum(r['rows'] for r in data['rowCounts']),
            'tableSetExact': True, 'primaryKeysExact': True, 'foreignKeysExact': True,
            'uniqueConstraintsExact': True, 'authoredIndexesPresent': True, 'checkInventoryExactAndEnforced': True}

try:
    require(not JOURNAL.exists(), 'An execution journal already exists; inspect it, never blindly rerun.')
    require(BACKUP.is_file(), 'Required empty-target backup is missing')
    fmt = '{"id":{{json .Id}},"image":{{json .Config.Image}},"running":{{json .State.Running}},"ports":{{json .NetworkSettings.Ports}},"mounts":{{json .Mounts}}}'
    container = json.loads(docker(['inspect', '--type', 'container', '--format', fmt, CONTAINER]))
    require(container['id'] == CONTAINER_ID and container['image'] == IMAGE and container['running'], 'Container identity/image/state mismatch')
    require(container['ports'].get('3306/tcp') == [{'HostIp':'127.0.0.1','HostPort':'62286'}], 'Published endpoint mismatch')
    require(len(container['mounts']) == 1 and container['mounts'][0]['Type'] == 'volume'
            and container['mounts'][0]['Name'] == 'enterflow-phase2-data'
            and container['mounts'][0]['Destination'] == '/var/lib/mysql', 'Persistent volume mismatch')
    state['containerId'] = container['id']
    identity = rows("SELECT JSON_OBJECT('database',DATABASE(),'version',VERSION(),'uuid',@@server_uuid);")[0]
    require(identity == {'database': DATABASE, 'version': '8.4.13', 'uuid': UUID}, 'Database identity/version mismatch')
    state['identityBefore'] = identity
    before = snapshot()
    require(not before['tables'], 'Target is not empty: no bootstrap attempted')
    (OUT / 'before-metadata.json').write_text(json.dumps(before, indent=2)+'\n', encoding='utf-8')
    backup_bytes = BACKUP.read_bytes()
    require(hashlib.sha256(backup_bytes).hexdigest() == 'be8188fe36d4e01199a4d7b06b791e7c89504fff0484b4897d47f0073eec0c62', 'New backup fingerprint mismatch')
    backup_text = backup_bytes.decode('utf-8')
    require('CREATE TABLE' not in backup_text and 'INSERT INTO' not in backup_text, 'Backup is not the inspected empty-target dump')
    require('USE `enterflow_phase2_db`;' in backup_text, 'Backup target marker mismatch')
    state['backup'] = {'file': str(BACKUP.relative_to(ROOT)), 'bytes': len(backup_bytes), 'sha256': hashlib.sha256(backup_bytes).hexdigest()}
    save()
    # Restore rehearsal uses ONLY the new empty-target dump on the same empty target.
    (OUT / 'empty-backup-replay-output.txt').write_text(mysql(backup_text), encoding='utf-8')
    require(not snapshot()['tables'], 'Empty-backup replay unexpectedly created tables')
    state['backup']['replayedOnSameEmptyTarget'] = True
    source = SQL.read_text(encoding='utf-8')
    state['bootstrap'] = {'file': str(SQL.relative_to(ROOT)), 'sha256': hashlib.sha256(SQL.read_bytes()).hexdigest()}
    state['status'] = 'applying'
    state['bootstrapAttempted'] = True
    save()
    output = mysql(source)
    (OUT / 'bootstrap-output.txt').write_text(output, encoding='utf-8')
    state['ddlBatchExitCode'] = 0
    state['status'] = 'verifying'
    save()
    after = snapshot()
    (OUT / 'after-metadata.json').write_text(json.dumps(after, indent=2)+'\n', encoding='utf-8')
    state['verification'] = verify(source, after)
    identity_after = rows("SELECT JSON_OBJECT('database',DATABASE(),'version',VERSION(),'uuid',@@server_uuid);")[0]
    require(identity_after == identity, 'Post-execution identity changed')
    state['identityAfter'] = identity_after
    actual_ddl = mysql('\n'.join(f'SHOW CREATE TABLE `{r["table"]}`;' for r in after['tables']))
    (OUT / 'actual-show-create-tables.txt').write_text(actual_ddl, encoding='utf-8')
    state['status'] = 'complete'
    state['completedAt'] = datetime.now(timezone(timedelta(hours=8))).isoformat()
    save()
    print(json.dumps(state, indent=2))
except Exception as exc:
    state['status'] = 'stopped'
    state['error'] = str(exc)
    if state.get('bootstrapAttempted'):
        try:
            partial = snapshot()
            (OUT / 'stopped-metadata.json').write_text(json.dumps(partial, indent=2)+'\n', encoding='utf-8')
            state['actualTablesAtStop'] = [r['table'] for r in partial['tables']]
        except Exception as inspect_error:
            state['inspectionError'] = str(inspect_error)
    # Refuse to overwrite an existing successful journal on an accidental rerun.
    if not JOURNAL.exists() or state.get('bootstrapAttempted'):
        save()
    print(json.dumps(state, indent=2))
    sys.exit(1)
