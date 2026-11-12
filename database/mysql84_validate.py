"""Approved isolated MySQL 8.4 validation. No XAMPP calls or migration edits.

--run refuses existing resource names. --verify/--test continue only the recorded
container, pinned image, volume, port and server identity. Never removes resources.
Passwords remain in memory/container configuration, not files or CLI arguments.
"""
from pathlib import Path
import inspect
import json
import os
import re
import secrets
import shutil
import socket
import subprocess
import sys
import time

import phase3_validate as base

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'validation_mysql84'
RESULTS = OUT / 'mysql84_results.json'
DB = 'enterflow_mysql84_test_db'
NAME = 'enterflow-mysql84-validation'
VOLUME = 'enterflow_mysql84_validation_data'
CONTEXT = 'desktop-linux'
LABEL = 'enterflow.validation=mysql84'
DOCKER = Path(r'C:\Users\Stephanie\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe')
if not DOCKER.is_file():
    DOCKER = Path(shutil.which('docker') or r'C:\Program Files\Docker\Docker\resources\bin\docker.exe')
PASSWORD = None
CONTAINER_ID = None
IMAGE_ID = None
SERVER_UUID = None
ADAPTED = False


def docker(arguments, *, input=None, env=None, timeout=120):
    env = dict(os.environ if env is None else env)
    env['PATH'] = str(DOCKER.parent) + os.pathsep + env.get('PATH', '')
    # Preserve LF bytes for the Linux shell password line; Windows text-mode
    # stdin would add CR and turn a correct password into a different value.
    result = subprocess.run([str(DOCKER), '--context', CONTEXT, *arguments],
                            input=input.encode('utf-8') if input is not None else None,
                            capture_output=True, env=env, timeout=timeout)
    result.stdout = result.stdout.decode('utf-8', errors='replace')
    result.stderr = result.stderr.decode('utf-8', errors='replace')
    return result


def checked(arguments, **kwargs):
    result = docker(arguments, **kwargs)
    if result.returncode:
        raise RuntimeError('Docker command failed: ' + result.stderr)
    return result.stdout


def save(report):
    OUT.mkdir(exist_ok=True)
    RESULTS.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def container_guard():
    info = json.loads(checked(['inspect', '--type', 'container', NAME]))[0]
    assert info['Id'] == CONTAINER_ID and info['Image'] == IMAGE_ID, 'Container/image identity conflict'
    assert info['State']['Running'], 'Test container is not running'
    assert info['Config']['Labels'].get('enterflow.validation') == 'mysql84'
    assert info['HostConfig']['PortBindings'] == {'3306/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '3307'}]}, 'Port binding conflict'
    mounts = info['Mounts']
    assert len(mounts) == 1 and mounts[0]['Type'] == 'volume' and mounts[0]['Name'] == VOLUME and mounts[0]['Destination'] == '/var/lib/mysql', 'Unexpected mount'
    assert info['HostConfig']['NanoCpus'] == 2000000000 and info['HostConfig']['Memory'] == 2147483648
    return info


def sql_cli(sql, selected=True, force=False):
    container_guard()
    assert PASSWORD and DB == 'enterflow_mysql84_test_db'
    executable_sql = re.sub(r'--[^\n]*', '', sql)
    assert not re.search(r'\b(?:enterflow_db|enterflow_test_db)\b', executable_sql, re.I), 'XAMPP schema name prohibited'
    args = ['mysql', '--no-defaults', '--host=127.0.0.1', '--port=3306', '--user=root',
            '--batch', '--raw', '--skip-column-names', '--default-character-set=utf8mb4', '--show-warnings']
    if selected:
        args.append('--database=' + DB)
    if force:
        args.append('--force')
    # read consumes only the password line; mysql receives the remaining stdin.
    shell = 'IFS= read -r MYSQL_PWD; export MYSQL_PWD; exec "$@"'
    return docker(['exec', '-i', NAME, 'sh', '-c', shell, 'enterflow-mysql-client', *args],
                  input=PASSWORD + '\n' + sql, timeout=120)


def query(sql, selected=True):
    result = sql_cli(sql, selected)
    if result.returncode or result.stderr.strip():
        raise RuntimeError('MySQL query failed: ' + result.stderr)
    return [json.loads(line) for line in result.stdout.splitlines() if line.strip()]


def environment():
    return query("SELECT JSON_OBJECT('version',VERSION(),'comment',@@version_comment,'uuid',@@server_uuid,'port',@@port,'database',DATABASE(),'sql_mode',@@sql_mode,'foreign_key_checks',@@foreign_key_checks,'unique_checks',@@unique_checks,'restrict_fk_on_non_standard_key',@@restrict_fk_on_non_standard_key,'charset',@@character_set_server,'collation',@@collation_server);", False)[0]


def assert_environment(env):
    assert env['version'].startswith('8.4.') and 'MySQL' in env['comment'], 'Not actual MySQL 8.4'
    assert env['foreign_key_checks'] == 1 and env['unique_checks'] == 1
    assert env['restrict_fk_on_non_standard_key'] == 1, 'Nonstandard FK restriction must stay enabled'
    assert 'STRICT_TRANS_TABLES' in env['sql_mode'] and 'ONLY_FULL_GROUP_BY' in env['sql_mode']
    assert env['port'] == 3306, 'Unexpected container server port'
    if SERVER_UUID:
        assert env['uuid'] == SERVER_UUID, 'Server UUID conflict'


def adapt_harness():
    global ADAPTED
    if ADAPTED:
        return
    # Importing base defines functions only. Every SQL/metadata/identity entry
    # point is replaced before calling any test; XAMPP's cli is never invoked.
    base.DB = DB
    base.OUT = OUT
    base.RESULTS = RESULTS
    base.SETUP = "SET SESSION foreign_key_checks=1; SET SESSION unique_checks=1; SET time_zone='+00:00'; SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;\n"
    base.cli = sql_cli
    base.query = query
    base.save = save
    base.main_snapshot = lambda: []  # No query/connection to either XAMPP schema.
    original_metadata = inspect.getsource(base.metadata)
    original_metadata = original_metadata.replace(
        "SELECT JSON_OBJECT('table',TABLE_NAME,'name',CONSTRAINT_NAME,'expression',CHECK_CLAUSE) FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() ORDER BY TABLE_NAME,CONSTRAINT_NAME;",
        "SELECT JSON_OBJECT('table',t.TABLE_NAME,'name',c.CONSTRAINT_NAME,'expression',c.CHECK_CLAUSE,'enforced',t.ENFORCED) FROM information_schema.CHECK_CONSTRAINTS c JOIN information_schema.TABLE_CONSTRAINTS t ON c.CONSTRAINT_SCHEMA=t.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME=t.CONSTRAINT_NAME WHERE c.CONSTRAINT_SCHEMA=DATABASE() AND t.CONSTRAINT_TYPE='CHECK' ORDER BY t.TABLE_NAME,c.CONSTRAINT_NAME;"
    )
    namespace = dict(base.__dict__)
    exec(compile(original_metadata, '<mysql84 metadata adapter>', 'exec'), namespace)
    mysql_metadata = namespace['metadata']
    def metadata_adapter():
        live = mysql_metadata()
        assert len(live['checks']) == 26 and all(r['enforced'] == 'YES' for r in live['checks']), 'CHECK not enforced'
        for row in live['checks']:
            row['raw_expression'] = row['expression']
            row['expression'] = row['expression'].replace("\\'", "'")
        for row in live['foreign_keys']:
            for field in ('update_rule', 'delete_rule'):
                row['raw_' + field] = row[field]
                if row[field] == 'NO ACTION': row[field] = 'RESTRICT'
        return live
    base.metadata = metadata_adapter
    # Keep fixtures identical; adapt only MariaDB's CHECK error number.
    source = inspect.getsource(base.integrity_tests).replace('4025', '3819')
    exec(compile(source, '<mysql84 integrity adapter>', 'exec'), base.__dict__)
    ADAPTED = True


def restore_run():
    global PASSWORD, CONTAINER_ID, IMAGE_ID, SERVER_UUID
    base.verify_hashes()
    report = json.loads(RESULTS.read_text(encoding='utf-8'))
    assert report['target'] == DB and report['docker_context'] == CONTEXT
    CONTAINER_ID, IMAGE_ID, SERVER_UUID = report['container_id'], report['image_id'], report['server_uuid']
    info = container_guard()
    PASSWORD = next(e.split('=', 1)[1] for e in info['Config']['Env'] if e.startswith('MYSQL_ROOT_PASSWORD='))
    assert_environment(environment())
    adapt_harness()
    return report


def failure_diagnostics():
    global PASSWORD, CONTAINER_ID, IMAGE_ID, SERVER_UUID
    report = json.loads(RESULTS.read_text(encoding='utf-8'))
    assert report['target'] == DB and report['status'] == 'migration_failed'
    CONTAINER_ID, IMAGE_ID, SERVER_UUID = report['container_id'], report['image_id'], report['server_uuid']
    info = container_guard()
    PASSWORD = next(e.split('=', 1)[1] for e in info['Config']['Env'] if e.startswith('MYSQL_ROOT_PASSWORD='))
    assert_environment(environment())
    observed = query("SELECT JSON_OBJECT('table',TABLE_NAME,'engine',ENGINE,'collation',TABLE_COLLATION) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME;")
    ledger = query("SELECT JSON_OBJECT('version',version,'applied_at',applied_at) FROM schema_migrations ORDER BY version;")
    reserved = {r['word'] for r in query("SELECT JSON_OBJECT('word',WORD) FROM information_schema.KEYWORDS WHERE RESERVED=1;")}
    tables, _ = base.drafts()
    collisions = []
    for name, table in tables.items():
        if name.upper() in reserved:
            collisions.append({'kind': 'table', 'name': name})
        for col in table['columns']:
            if col.upper() in reserved:
                collisions.append({'kind': 'column', 'table': name, 'name': col})
    report['failure_diagnostics'] = {'table_count': len(observed), 'tables': observed, 'ledger': ledger,
        'reserved_identifier_collisions': collisions,
        'application_schemas': query("SELECT JSON_OBJECT('schema',SCHEMA_NAME) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME NOT IN ('mysql','information_schema','performance_schema','sys');", False),
        'role_seed_rows': query("SELECT JSON_OBJECT('count',COUNT(*)) FROM roles;")[0]['count']}
    save(report)
    print(json.dumps(report['failure_diagnostics'], indent=2))


def approved_reset_and_retest():
    report = restore_run()
    assert report['status'] == 'migration_failed', 'Reset is authorized only for the recorded failed test run'
    assert query("SELECT JSON_OBJECT('database',DATABASE(),'uuid',@@server_uuid);")[0] == {'database': DB, 'uuid': SERVER_UUID}
    manifest = base.verify_hashes()
    old = json.loads((OUT / 'reviewed_hashes_before_quote.json').read_text(encoding='utf-8'))
    for prior, current in zip(old['files'], manifest['files']):
        if current['file'] != 'migrations/002_orders_quotations.sql':
            assert prior['sha256'] == current['sha256'], 'Unapproved migration/seed change'
    reserved = {r['word'] for r in query("SELECT JSON_OBJECT('word',WORD) FROM information_schema.KEYWORDS WHERE RESERVED=1;")}
    collisions = []
    quoted_reserved = []
    for entry in manifest['files']:
        sql = re.sub(r'--[^\n]*', '', (ROOT / entry['file']).read_text(encoding='utf-8'))
        quoted = re.findall(r'`([^`]+)`', sql)
        quoted_reserved.extend({'file': entry['file'], 'identifier': word} for word in quoted if word.upper() in reserved)
        # All table, column, key/constraint and FK identifiers in this SQL subset.
        for table, body in re.findall(r'CREATE TABLE (\w+)\s*\((.*?)\) ENGINE=', sql, re.S):
            identifiers = [('table', table)]
            for piece in base.split_sql(body):
                col = re.match(r'(`?)(\w+)\1\s+(?:BIGINT|SMALLINT|INT|VARCHAR|CHAR|DATETIME|DATE|BOOLEAN|DECIMAL|TEXT|ENUM)\b', piece)
                if col and not col[1]: identifiers.append(('column', col[2]))
                key = re.match(r'(?:UNIQUE KEY|KEY|CONSTRAINT) (\w+)\b', piece)
                if key: identifiers.append(('key/constraint', key[1]))
                fk = re.match(r'FOREIGN KEY\s*\(([^)]+)\) REFERENCES (\w+)\(([^)]+)\)', piece)
                if fk:
                    identifiers.extend(('FK identifier', word.strip()) for word in [*fk[1].split(','), fk[2], *fk[3].split(',')])
            collisions.extend({'file': entry['file'], 'kind': kind, 'identifier': word} for kind, word in identifiers if word.upper() in reserved)
    assert not collisions, 'Additional unquoted reserved identifiers: ' + json.dumps(collisions)
    archive = OUT / 'mysql84_failed_reserved_identifier.json'
    assert not archive.exists(), 'Prior reset archive exists; stop before changing anything'
    archive.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    report['reserved_identifier_review'] = {'unquoted_collisions': collisions, 'quoted_reserved_identifiers': quoted_reserved}
    report['approved_reset'] = {'schema': DB, 'container_id': CONTAINER_ID, 'server_uuid': SERVER_UUID,
                                'reason': 'Explicit user approval to reset only this isolated test schema after quoting last_value.'}
    save(report)
    result = sql_cli('DROP DATABASE `enterflow_mysql84_test_db`;', False)
    assert result.returncode == 0 and not result.stderr.strip(), 'Authorized test-schema reset failed: ' + result.stderr
    report.update(database_created=False, migrations=[], reviewed_files=manifest['files'], status='approved_test_schema_reset')
    report.pop('runner_error', None)
    report.pop('failure_diagnostics', None)
    report.pop('final_container_state', None)
    save(report)
    print('Reserved-identifier review passed; only the approved isolated test schema was reset.', flush=True)
    apply_and_test(report, manifest)


def resume_initialization(check_only=False):
    global PASSWORD, CONTAINER_ID, IMAGE_ID, SERVER_UUID
    report = json.loads(RESULTS.read_text(encoding='utf-8'))
    assert report['target'] == DB and report['status'] == 'container_started'
    assert not report['migrations'], 'Not a pre-migration startup recovery'
    CONTAINER_ID, IMAGE_ID = report['container_id'], report['image_id']
    SERVER_UUID = report.get('server_uuid')
    info = container_guard()
    PASSWORD = next(e.split('=', 1)[1] for e in info['Config']['Env'] if e.startswith('MYSQL_ROOT_PASSWORD='))
    env = environment()
    assert_environment(env)
    if check_only:
        print(json.dumps({'connection_check': 'passed', 'environment': env}, indent=2))
        return
    if report.get('runner_error'):
        report.setdefault('previous_runner_diagnostics', []).append(report.pop('runner_error'))
    report['startup_harness_correction'] = 'Pass stdin as UTF-8 bytes to avoid Windows CRLF changing the Linux password line.'
    save(report)
    adapt_harness()
    apply_and_test(report, base.verify_hashes())


def run(retry_pull=False):
    global PASSWORD, CONTAINER_ID, IMAGE_ID, SERVER_UUID
    manifest = base.verify_hashes()
    previous = json.loads(RESULTS.read_text(encoding='utf-8')) if RESULTS.exists() else None
    if previous:
        assert retry_pull and previous['status'] == 'preflight_passed' and not previous.get('container_id') and not previous['database_created'] and not previous['migrations'], 'Prior resources/run exist; stop rather than replace'
    else:
        assert not retry_pull, 'No failed pre-creation pull to retry'
    context = json.loads(checked(['context', 'inspect', CONTEXT]))[0]
    assert context['Endpoints']['docker']['Host'] == 'npipe:////./pipe/dockerDesktopLinuxEngine', 'Nonlocal Docker context'
    info = json.loads(checked(['info', '--format', '{{json .}}']))
    assert info['OSType'] == 'linux' and info['NCPU'] >= 2 and info['MemTotal'] >= 3 * 1024**3
    assert shutil.disk_usage(ROOT).free >= 5 * 1024**3, 'Insufficient host free disk'
    names = checked(['ps', '-a', '--format', '{{.Names}}']).splitlines()
    volumes = checked(['volume', 'ls', '--format', '{{.Name}}']).splitlines()
    assert NAME not in names and VOLUME not in volumes, 'Resource conflict: stop without changing existing resources'
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 3307))
    report = {'target': DB, 'docker_context': CONTEXT, 'status': 'preflight_passed', 'database_created': False,
              'reviewed_files': manifest['files'], 'migrations': [], 'main_catalog_before': [],
              'xampp_access': 'No XAMPP SQL or data access; all SQL routes through the named container.',
              'docker': {'version': info['ServerVersion'], 'os': info['OSType'], 'cpus': info['NCPU'], 'memory': info['MemTotal']}}
    if previous:
        report['precreation_pull_issue'] = (OUT / 'image_pull.txt').read_text(encoding='utf-8')
    save(report)
    print('Preflight passed. Pulling Docker Official Image mysql:8.4.', flush=True)
    pull = docker(['pull', 'mysql:8.4'], timeout=600)
    (OUT / 'image_pull.txt').write_text(pull.stdout + pull.stderr, encoding='utf-8')
    assert pull.returncode == 0, 'Image pull failed; no container created'
    image = json.loads(checked(['image', 'inspect', 'mysql:8.4']))[0]
    digest = next(d for d in image['RepoDigests'] if d.startswith('mysql@sha256:'))
    IMAGE_ID = image['Id']
    report.update(image_id=IMAGE_ID, image_digest=digest, image_architecture=image['Architecture'])
    save(report)
    assert NAME not in checked(['ps', '-a', '--format', '{{.Names}}']).splitlines()
    assert VOLUME not in checked(['volume', 'ls', '--format', '{{.Name}}']).splitlines()
    checked(['volume', 'create', '--label', LABEL, VOLUME])
    PASSWORD = secrets.token_urlsafe(36)
    env = os.environ.copy()
    env['MYSQL_ROOT_PASSWORD'] = PASSWORD
    output = checked(['run', '-d', '--name', NAME, '--label', LABEL,
                      '--cpus', '2', '--memory', '2g', '--publish', '127.0.0.1:3307:3306',
                      '--mount', f'type=volume,src={VOLUME},dst=/var/lib/mysql',
                      '--env', 'MYSQL_ROOT_PASSWORD', digest], env=env)
    CONTAINER_ID = output.strip()
    report.update(container_id=CONTAINER_ID, volume=VOLUME, host_binding='127.0.0.1:3307', status='container_started')
    save(report)
    print('Pinned image started; waiting for MySQL initialization.', flush=True)
    deadline = time.monotonic() + 180
    while True:
        ready = sql_cli('SELECT 1;', False)
        if ready.returncode == 0 and ready.stdout.strip() == '1': break
        if time.monotonic() >= deadline: raise RuntimeError('MySQL readiness timeout; container retained')
        time.sleep(2)
    apply_and_test(report, manifest)


def apply_and_test(report, manifest):
    global SERVER_UUID
    envinfo = environment()
    assert_environment(envinfo)
    SERVER_UUID = envinfo['uuid']
    report.update(environment=envinfo, server_uuid=SERVER_UUID)
    save(report)
    if report['database_created']:
        # Resume only our recorded empty schema; never recreate or overwrite it.
        assert query("SELECT JSON_OBJECT('objects',COUNT(*)) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE();")[0]['objects'] == 0, 'Unexpected objects in recorded schema'
    else:
        assert not query(f"SELECT JSON_OBJECT('schema',SCHEMA_NAME) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='{DB}';", False), 'Test schema exists unexpectedly'
        result = sql_cli(f'CREATE DATABASE {DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;', False)
        assert result.returncode == 0 and not result.stderr.strip(), result.stderr
        report['database_created'] = True
        save(report)
    adapt_harness()
    assert query("SELECT JSON_OBJECT('database',DATABASE());")[0]['database'] == DB
    for entry in manifest['files']:
        base.verify_hashes()
        result = sql_cli(base.SETUP + (ROOT / entry['file']).read_text(encoding='utf-8'))
        report['migrations'].append({'file': entry['file'], 'exit_code': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr})
        save(report)
        print(entry['file'], 'exit=', result.returncode, flush=True)
        if result.returncode or result.stderr.strip():
            report['status'] = 'migration_failed'
            save(report)
            raise RuntimeError('STOP: MySQL migration failed. Drafts unchanged. ' + result.stderr)
    report['status'] = 'migrations_and_seed_applied'
    save(report)
    print('Migrations/seed applied. Comparing actual schema.', flush=True)
    base.verify()
    print('Running rollback-only integrity cases.', flush=True)
    base.integrity_tests()
    base.verify()


def finish():
    report = json.loads(RESULTS.read_text(encoding='utf-8'))
    info = container_guard()
    report['final_environment'] = environment()
    report['final_container_state'] = {'running': info['State']['Running'], 'id': info['Id'], 'image': info['Image'], 'binding': info['HostConfig']['PortBindings']}
    report['reviewed_hashes_still_match'] = bool(base.verify_hashes())
    logs = checked(['logs', NAME])
    (OUT / 'server_stdout.txt').write_text(logs.replace(PASSWORD, '[REDACTED]'), encoding='utf-8')
    rawlogs = docker(['logs', NAME])
    (OUT / 'server_stderr.txt').write_text(rawlogs.stderr.replace(PASSWORD, '[REDACTED]'), encoding='utf-8')
    save(report)
    print('Finished. Container and data volume retained.', flush=True)


if __name__ == '__main__':
    try:
        if sys.argv[1:] == ['--run']:
            run()
        elif sys.argv[1:] == ['--retry-pull']:
            run(retry_pull=True)
        elif sys.argv[1:] == ['--connection-check']:
            resume_initialization(check_only=True)
            raise SystemExit(0)
        elif sys.argv[1:] == ['--resume-initialization']:
            resume_initialization()
        elif sys.argv[1:] == ['--failure-diagnostics']:
            failure_diagnostics()
        elif sys.argv[1:] == ['--approved-reset-retest']:
            approved_reset_and_retest()
        elif sys.argv[1:] == ['--validate-existing']:
            restore_run()
            base.verify()
            base.integrity_tests()
            base.verify()
        elif sys.argv[1:] in (['--verify'], ['--test']):
            restore_run()
            base.verify() if sys.argv[1] == '--verify' else base.integrity_tests()
        else:
            raise SystemExit('Use --run for new isolated resources, or --verify/--test for this recorded run.')
        finish()
    except Exception as error:
        # No automatic repairs, teardown, database replacement or draft edits.
        if RESULTS.exists():
            report = json.loads(RESULTS.read_text(encoding='utf-8'))
            report['runner_error'] = str(error).replace(PASSWORD, '[REDACTED]') if PASSWORD else str(error)
            save(report)
        print('STOP:', str(error).replace(PASSWORD, '[REDACTED]') if PASSWORD else str(error), flush=True)
        raise SystemExit(1)
