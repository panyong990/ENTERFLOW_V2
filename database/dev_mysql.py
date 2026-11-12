"""Manage only the approved permanent Enter-Flow Docker database.

Install refuses existing resources/secrets. Later commands require recorded IDs,
image, UUID, mount and loopback binding. No XAMPP client or SQL is used.
"""
from pathlib import Path
import hashlib
import json
import os
import re
import secrets
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone

import mysql84_validate as adapter
import phase3_validate as comparison

ROOT = Path(__file__).resolve().parent
WORKSPACE = ROOT.parent
NAME = 'enterflow-mysql-dev'
VOLUME = 'enterflow-mysql-dev-data'
DB = 'enterflow_db'
DIGEST = 'mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902'
ENV_FILE = ROOT / '.env.dev'
OUT = ROOT / 'development'
RESULTS = OUT / 'installation.json'
SECRETS = {}
CONTAINER_ID = None
IMAGE_ID = None
SERVER_UUID = None


def redact(value):
    for key in ('MYSQL_ROOT_PASSWORD', 'DB_PASSWORD'):
        if SECRETS.get(key): value = value.replace(SECRETS[key], '[REDACTED]')
    return value


def docker(args, **kwargs):
    result = adapter.docker(args, **kwargs)
    result.stdout, result.stderr = redact(result.stdout), redact(result.stderr)
    return result


def checked(args, **kwargs):
    result = docker(args, **kwargs)
    if result.returncode:
        raise RuntimeError('Docker command failed: ' + result.stderr)
    return result.stdout


def compose(args, **kwargs):
    return checked(['compose', '--env-file', str(ENV_FILE), '-f', str(ROOT / 'compose.dev.yaml'), *args], **kwargs)


def save(report):
    OUT.mkdir(exist_ok=True)
    text = json.dumps(report, indent=2, ensure_ascii=False) + '\n'
    assert redact(text) == text, 'Refusing to write a secret into the report'
    RESULTS.write_text(text, encoding='utf-8')


def protect_file(path):
    user = subprocess.run(['whoami'], capture_output=True, text=True, check=True).stdout.strip()
    result = subprocess.run(['icacls', str(path.resolve()), '/inheritance:r', '/grant:r', user + ':(F)', '*S-1-5-18:(F)'], capture_output=True)
    assert result.returncode == 0, 'Could not restrict private file permissions'


def context_guard():
    context = json.loads(checked(['context', 'inspect', 'desktop-linux']))[0]
    assert context['Endpoints']['docker']['Host'] == 'npipe:////./pipe/dockerDesktopLinuxEngine', 'Nonlocal Docker context'


def guard():
    context_guard()
    obj = json.loads(checked(['inspect', '--type', 'container', NAME]))[0]
    assert obj['Id'] == CONTAINER_ID and obj['Image'] == IMAGE_ID, 'Development container/image identity mismatch'
    assert obj['State']['Running'], 'Development container is stopped'
    assert obj['Config']['Labels'].get('enterflow.role') == 'development'
    assert obj['HostConfig']['PortBindings'] == {'3306/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '3308'}]}, 'Wrong port binding'
    mounts = obj['Mounts']
    assert len(mounts) == 1 and mounts[0]['Type'] == 'volume' and mounts[0]['Name'] == VOLUME and mounts[0]['Destination'] == '/var/lib/mysql', 'Wrong data mount'
    return obj


def validation_snapshot():
    obj = json.loads(checked(['inspect', '--type', 'container', 'enterflow-mysql84-validation']))[0]
    return {'id': obj['Id'], 'image': obj['Image'], 'running': obj['State']['Running'],
            'started_at': obj['State']['StartedAt'], 'binding': obj['HostConfig']['PortBindings'],
            'mounts': [{'type': m['Type'], 'name': m.get('Name'), 'destination': m['Destination']} for m in obj['Mounts']]}


def cli(sql, selected=True, force=False, app=False, via_host=False):
    guard()
    assert not force, 'Force mode is prohibited for permanent setup'
    assert DB == 'enterflow_db' and (not via_host or app)
    user = SECRETS['DB_USER'] if app else 'root'
    password = SECRETS['DB_PASSWORD'] if app else SECRETS['MYSQL_ROOT_PASSWORD']
    args = ['mysql', '--no-defaults', '--user=' + user, '--batch', '--raw', '--skip-column-names', '--default-character-set=utf8mb4', '--show-warnings']
    if app:
        args += ['--protocol=TCP', '--host=' + ('host.docker.internal' if via_host else '127.0.0.1'), '--port=' + ('3308' if via_host else '3306'), '--ssl-mode=REQUIRED']
    else:
        args += ['--protocol=socket']
    if selected: args.append('--database=' + DB)
    command = ['exec', '-i', NAME, 'sh', '-c', 'IFS= read -r MYSQL_PWD; export MYSQL_PWD; exec "$@"', 'enterflow-development-client', *args]
    return docker(command, input=password + '\n' + sql)


def query(sql, selected=True, **kwargs):
    result = cli(sql, selected, **kwargs)
    if result.returncode or result.stderr.strip(): raise RuntimeError('Development SQL failed: ' + result.stderr)
    return [json.loads(line) for line in result.stdout.splitlines() if line.strip()]


def identity():
    obj = query("SELECT JSON_OBJECT('database',DATABASE(),'version',VERSION(),'uuid',@@server_uuid,'sql_mode',@@sql_mode,'foreign_key_checks',@@foreign_key_checks,'unique_checks',@@unique_checks,'restrict_fk_on_non_standard_key',@@restrict_fk_on_non_standard_key);")[0]
    assert obj['database'] == DB and obj['version'] == '8.4.13'
    assert obj['foreign_key_checks'] == 1 and obj['unique_checks'] == 1 and obj['restrict_fk_on_non_standard_key'] == 1
    assert 'STRICT_TRANS_TABLES' in obj['sql_mode'] and 'ONLY_FULL_GROUP_BY' in obj['sql_mode']
    if SERVER_UUID: assert obj['uuid'] == SERVER_UUID, 'Server UUID mismatch'
    return obj


def read_env():
    global SECRETS
    SECRETS = dict(line.split('=', 1) for line in ENV_FILE.read_text(encoding='utf-8').splitlines() if line and not line.startswith('#'))
    assert SECRETS['DB_HOST'] == '127.0.0.1' and SECRETS['DB_PORT'] == '3308' and SECRETS['DB_NAME'] == DB and SECRETS['DB_USER'] == 'enterflow_app'
    assert all(re.fullmatch(r'[0-9a-f]{64}', SECRETS[key]) for key in ('MYSQL_ROOT_PASSWORD', 'DB_PASSWORD'))


def connect_recorded():
    global CONTAINER_ID, IMAGE_ID, SERVER_UUID
    read_env()
    report = json.loads(RESULTS.read_text(encoding='utf-8'))
    assert report['target'] == DB and report['container_name'] == NAME and report['volume'] == VOLUME
    CONTAINER_ID, IMAGE_ID, SERVER_UUID = report['container_id'], report['image_id'], report['server_uuid']
    identity()
    return report


def adapt_comparison():
    adapter.DB, adapter.OUT, adapter.RESULTS = DB, OUT, RESULTS
    adapter.sql_cli, adapter.query, adapter.save = cli, query, save
    adapter.adapt_harness()


def check_app():
    result = query("SELECT JSON_OBJECT('database',DATABASE(),'uuid',@@server_uuid,'account',CURRENT_USER(),'tables',(SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()),'ledger',(SELECT COUNT(*) FROM schema_migrations));", app=True, via_host=True)[0]
    assert result['uuid'] == SERVER_UUID and result['database'] == DB and result['account'] == 'enterflow_app@%' and result['tables'] == 70 and result['ledger'] == 5
    grants = query("SELECT JSON_OBJECT('privilege',PRIVILEGE_TYPE,'grantable',IS_GRANTABLE) FROM information_schema.SCHEMA_PRIVILEGES WHERE GRANTEE=CONCAT(QUOTE('enterflow_app'),'@',QUOTE('%')) AND TABLE_SCHEMA=DATABASE();")
    assert {row['privilege'] for row in grants} == {'SELECT', 'INSERT', 'UPDATE', 'DELETE'} and all(r['grantable'] == 'NO' for r in grants)
    globals_ = query("SELECT JSON_OBJECT('privilege',PRIVILEGE_TYPE) FROM information_schema.USER_PRIVILEGES WHERE GRANTEE=CONCAT(QUOTE('enterflow_app'),'@',QUOTE('%')); ")
    assert {row['privilege'] for row in globals_} <= {'USAGE'}, 'App account has global privileges'
    roles = query("SELECT JSON_OBJECT('roles',COUNT(*)) FROM mysql.role_edges WHERE TO_USER='enterflow_app';")[0]
    assert roles['roles'] == 0
    return {'published_endpoint_authentication': result, 'schema_privileges': grants, 'global_privileges': globals_, 'roles': roles}


def install():
    global SECRETS, CONTAINER_ID, IMAGE_ID, SERVER_UUID
    context_guard()
    manifest = comparison.verify_hashes()
    validated = json.loads((ROOT / 'validation_mysql84/mysql84_results.json').read_text(encoding='utf-8'))
    assert validated['status'] == 'local_validation_passed' and manifest['files'] == validated['reviewed_files']
    assert not ENV_FILE.exists() and not RESULTS.exists(), 'Existing credentials/installation record: stop, no overwrite'
    assert NAME not in checked(['ps', '-a', '--format', '{{.Names}}']).splitlines(), 'Container name conflict'
    assert VOLUME not in checked(['volume', 'ls', '--format', '{{.Name}}']).splitlines(), 'Volume name conflict'
    with socket.socket() as probe: probe.bind(('127.0.0.1', 3308))
    image = json.loads(checked(['image', 'inspect', DIGEST]))[0]
    IMAGE_ID = image['Id']
    assert IMAGE_ID == validated['image_id'] and image['Architecture'] == 'amd64'
    protected = validation_snapshot()
    assert protected['id'] == validated['container_id'] and protected['running']
    gitargs = ['git', '-c', 'safe.directory=' + str(WORKSPACE).replace('\\', '/'), 'check-ignore', str(ENV_FILE)]
    assert subprocess.run(gitargs, capture_output=True).returncode == 0, 'Secret file must be Git-ignored'
    SECRETS = {'MYSQL_ROOT_PASSWORD': secrets.token_hex(32), 'DB_HOST': '127.0.0.1', 'DB_PORT': '3308', 'DB_NAME': DB,
               'DB_USER': 'enterflow_app', 'DB_PASSWORD': secrets.token_hex(32), 'DB_POOL_MAX': '5', 'DB_TIMEZONE': 'Z', 'DB_SOCKET_PATH': ''}
    with ENV_FILE.open('x', encoding='utf-8') as stream:
        stream.write(''.join(key + '=' + value + '\n' for key, value in SECRETS.items()))
    protect_file(ENV_FILE)
    report = {'target': DB, 'container_name': NAME, 'volume': VOLUME, 'image_id': IMAGE_ID, 'image_digest': DIGEST,
              'endpoint': '127.0.0.1:3308', 'status': 'preflight_passed', 'database_created': False,
              'reviewed_files': manifest['files'], 'migrations': [], 'main_catalog_before': [], 'protected_validation_before': protected}
    save(report)
    compose(['config', '--quiet'])
    print('Preflight passed; creating only the approved permanent development resources.', flush=True)
    output = compose(['up', '-d', '--wait', '--wait-timeout', '210'], timeout=240)
    obj = json.loads(checked(['inspect', '--type', 'container', NAME]))[0]
    CONTAINER_ID = obj['Id']
    guard()
    env = identity()
    SERVER_UUID = env['uuid']
    report.update(container_id=CONTAINER_ID, server_uuid=SERVER_UUID, environment=env, database_created=True, status='container_ready')
    save(report)
    assert query("SELECT JSON_OBJECT('tables',COUNT(*)) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE();")[0]['tables'] == 0, 'New database is not empty'
    adapt_comparison()
    for entry in manifest['files']:
        comparison.verify_hashes()
        result = cli(comparison.SETUP + (ROOT / entry['file']).read_text(encoding='utf-8'))
        report['migrations'].append({'file': entry['file'], 'exit_code': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr})
        save(report)
        assert result.returncode == 0 and not result.stderr.strip(), 'Migration failed: ' + entry['file'] + ': ' + result.stderr
        print('Applied ' + entry['file'], flush=True)
    report['status'] = 'migrations_and_seed_applied'
    save(report)
    comparison.verify()
    report = json.loads(RESULTS.read_text(encoding='utf-8'))
    assert not query("SELECT JSON_OBJECT('user',User,'host',Host) FROM mysql.user WHERE User='enterflow_app';"), 'Backend connection account already exists'
    result = cli("CREATE USER 'enterflow_app'@'%' IDENTIFIED BY '" + SECRETS['DB_PASSWORD'] + "'; GRANT SELECT,INSERT,UPDATE,DELETE ON enterflow_db.* TO 'enterflow_app'@'%';")
    assert result.returncode == 0 and not result.stderr.strip(), 'Restricted account creation failed: ' + result.stderr
    report['app_connection'] = check_app()
    report['status'] = 'installed_before_restart'
    save(report)
    print('Schema, seeds and restricted host-port login verified; restarting only development MySQL.', flush=True)
    started_before = guard()['State']['StartedAt']
    compose(['restart'], timeout=120)
    deadline = time.monotonic() + 180
    while True:
        obj = guard()
        if obj['State'].get('Health', {}).get('Status') == 'healthy': break
        assert time.monotonic() < deadline, 'Restart health timeout'
        time.sleep(2)
    assert obj['State']['StartedAt'] != started_before and identity()['uuid'] == SERVER_UUID
    comparison.verify()
    report = json.loads(RESULTS.read_text(encoding='utf-8'))
    report['app_connection_after_restart'] = check_app()
    report['protected_validation_after'] = validation_snapshot()
    assert report['protected_validation_after'] == protected, 'Protected validation container changed'
    report['persistence'] = {'passed': True, 'container_id': CONTAINER_ID, 'same_uuid': SERVER_UUID,
                              'same_volume': VOLUME, 'started_before': started_before, 'started_after': obj['State']['StartedAt'],
                              'schema_and_seeds_reverified': True}
    report['status'] = 'development_database_ready'
    report['final_container'] = {'running': obj['State']['Running'], 'health': obj['State']['Health']['Status'],
                                 'binding': obj['HostConfig']['PortBindings'], 'restart_policy': obj['HostConfig']['RestartPolicy']}
    save(report)
    print('Permanent development database ready; persistence and protected-container checks passed.', flush=True)


def backup():
    connect_recorded()
    guard()
    target = ROOT / 'backups' / ('enterflow-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.sql')
    target.parent.mkdir(exist_ok=True)
    assert not target.exists(), 'Backup filename conflict'
    args = [str(adapter.DOCKER), '--context', 'desktop-linux', 'exec', '-i', NAME,
            'sh', '-c', 'IFS= read -r MYSQL_PWD; export MYSQL_PWD; exec "$@"', 'enterflow-backup',
            'mysqldump', '--no-defaults', '--protocol=socket', '--user=root', '--single-transaction',
            '--skip-lock-tables', '--no-tablespaces', '--set-gtid-purged=OFF',
            '--default-character-set=utf8mb4', '--routines', '--events', '--triggers', DB]
    env = os.environ.copy()
    env['PATH'] = str(adapter.DOCKER.parent) + os.pathsep + env.get('PATH', '')
    with target.open('xb') as out:
        protect_file(target)
        process = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=out, stderr=subprocess.PIPE, env=env)
        _, error = process.communicate((SECRETS['MYSQL_ROOT_PASSWORD'] + '\n').encode('utf-8'), timeout=300)
    assert process.returncode == 0 and not error.strip(), 'Backup failed; file may be incomplete: ' + redact(error.decode('utf-8', errors='replace'))
    assert target.stat().st_size > 0
    metadata = {'database': DB, 'source_uuid': SERVER_UUID, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                'file': target.name, 'bytes': target.stat().st_size, 'method': 'single-transaction, explicit enterflow_db only'}
    target.with_suffix('.metadata.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
    print(str(target))


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ''
    if mode == 'install': install(); return
    if mode == 'backup': backup(); return
    report = connect_recorded()
    if mode == 'verify':
        adapt_comparison(); comparison.verify(); return
    if mode == 'status':
        print(json.dumps({'identity': identity(), 'state': guard()['State']['Status'], 'endpoint': '127.0.0.1:3308'}, indent=2)); return
    raise SystemExit('Use install, verify, status or backup. Lifecycle/restore commands are documented separately.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        if RESULTS.exists():
            report = json.loads(RESULTS.read_text(encoding='utf-8'))
            report['unexpected_error'] = redact(str(error))
            save(report)
        print('STOP: ' + redact(str(error)), flush=True)
        raise SystemExit(1)
