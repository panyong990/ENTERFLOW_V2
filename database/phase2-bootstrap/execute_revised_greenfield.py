"""Guarded P2B002 rebuild and separate-schema restoration, target only.

Never imports application code, historical SQL or old authoring helpers.
Old metadata is captured ONLY for emptiness/history, never as the new design.
"""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import argparse
import hashlib
import json
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
OUT = ROOT/'database/phase2-execution/P2B002-2026-11-22'
SQL = HERE/'P2B002_revised_erd_greenfield.sql'
DESIGN = HERE/'P2B002_design_manifest.json'
DB = 'enterflow_phase2_db'
RESTORE = 'enterflow_phase2_restore_p2b002'
CONTAINER = 'enterflow-phase2-mysql'
UUID = '0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8'
ID = '2acac2d1b6069b6ed30a95b69eb582bd68ef9f365bc092f46530306f34a9eb73'
IMAGE = 'mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902'
JOURNAL = OUT/'execution.json'
state = {'database':DB,'container':CONTAINER,'restoreDatabase':RESTORE,'status':'preflight',
         'startedAt':datetime.now(timezone(timedelta(hours=8))).isoformat(),'ddlStarted':False}

def require(value,message):
    if not value:
        raise RuntimeError(message)

def save(name,data):
    (OUT/name).write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')

def docker(args,stdin=None):
    p = subprocess.run(['docker','--context','desktop-linux',*args],input=stdin,
                       text=True,encoding='utf-8',capture_output=True)
    if p.returncode:
        raise RuntimeError(f'Exit {p.returncode}: {p.stderr.strip()}')
    return p.stdout

def mysql(sql,db=DB):
    require(db in (DB,RESTORE),'Refuse any other database')
    cmd = f'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql --protocol=socket --user=root --database={db} --batch --raw --skip-column-names --show-warnings'
    return docker(['exec','-i',CONTAINER,'sh','-c',cmd],sql)

def rows(sql,db=DB):
    result=[]
    for line in mysql(sql,db).splitlines():
        if not line.strip(): continue
        if line.startswith(('Warning (Code ','Note (Code ')):
            state.setdefault('mysqlWarnings',[]).append(line)
            continue
        result.append(json.loads(line))
    return result

def identity(db=DB):
    return rows("SELECT JSON_OBJECT('database',DATABASE(),'version',VERSION(),'uuid',@@server_uuid);",db)[0]

def guard():
    fmt = '{"id":{{json .Id}},"image":{{json .Config.Image}},"running":{{json .State.Running}},"ports":{{json .NetworkSettings.Ports}},"mounts":{{json .Mounts}}}'
    obj = json.loads(docker(['inspect','--type','container','--format',fmt,CONTAINER]))
    require(obj['id']==ID and obj['image']==IMAGE and obj['running'],'Target container identity/image/running state mismatch')
    require(obj['ports'].get('3306/tcp')==[{'HostIp':'127.0.0.1','HostPort':'62286'}],'Target endpoint mismatch')
    require(len(obj['mounts'])==1 and obj['mounts'][0]['Type']=='volume'
      and obj['mounts'][0]['Name']=='enterflow-phase2-data' and obj['mounts'][0]['Destination']=='/var/lib/mysql','Target volume mismatch')
    require(identity()=={'database':DB,'version':'8.4.13','uuid':UUID},'Database/version/UUID mismatch')
    return obj

def no_application():
    sessions = rows("SELECT JSON_OBJECT('id',ID,'user',USER,'host',HOST,'command',COMMAND) FROM performance_schema.processlist WHERE DB=DATABASE() AND ID<>CONNECTION_ID();")
    require(not sessions,'Another connection is using the Phase 2 database')
    p = subprocess.run(['powershell.exe','-NoProfile','-Command',
        '@(Get-NetTCPConnection -RemotePort 62286 -State Established -ErrorAction SilentlyContinue).Count'],
        text=True,capture_output=True)
    require(p.returncode==0 and p.stdout.strip()=='0','Existing application TCP connection to Phase 2 endpoint')
    configs=[]
    for name in ('.env','.env.local','backend/.env','backend/.env.local','database/.env.dev'):
        path=ROOT/name
        if path.is_file():
            text=path.read_text(encoding='utf-8-sig')
            selected=re.search(r'^\s*DB_NAME\s*=\s*[\x27\x22]?([^\r\n\x27\x22#]+)',text,re.M)
            if selected:
                database=selected.group(1).strip()
                require(database!=DB,f'Application configuration {name} selects the target')
                configs.append({'file':name,'database':database})
    return {'otherTargetSessions':sessions,'establishedTargetTcpConnections':0,'applicationConfigs':configs,
            'scope':'Observed quiescence plus configuration; no app was switched or stopped.'}

def metadata(db=DB):
    data={}
    data['tables']=rows("SELECT JSON_OBJECT('table',table_name,'type',table_type,'engine',engine,'collation',table_collation) FROM information_schema.tables WHERE table_schema=DATABASE() ORDER BY table_name;",db)
    require(all(r['type']=='BASE TABLE' for r in data['tables']),'Unexpected view: refuse querying potentially cross-schema view data')
    require(not any('migration' in r['table'].lower() for r in data['tables']),'Migration history object detected: refuse contents/cleanup')
    data['columns']=rows("SELECT JSON_OBJECT('table',table_name,'column',column_name,'position',ordinal_position,'type',column_type,'nullable',is_nullable,'default',column_default,'extra',extra,'generated',generation_expression,'collation',collation_name) FROM information_schema.columns WHERE table_schema=DATABASE() ORDER BY table_name,ordinal_position;",db)
    data['keys']=rows("SELECT JSON_OBJECT('table',table_name,'name',constraint_name,'position',ordinal_position,'column',column_name,'parent',referenced_table_name,'parentColumn',referenced_column_name) FROM information_schema.key_column_usage WHERE table_schema=DATABASE() ORDER BY table_name,constraint_name,ordinal_position;",db)
    data['constraints']=rows("SELECT JSON_OBJECT('table',table_name,'name',constraint_name,'type',constraint_type,'enforced',enforced) FROM information_schema.table_constraints WHERE table_schema=DATABASE() ORDER BY table_name,constraint_name;",db)
    data['indexes']=rows("SELECT JSON_OBJECT('table',table_name,'name',index_name,'position',seq_in_index,'column',column_name,'nonUnique',non_unique) FROM information_schema.statistics WHERE table_schema=DATABASE() ORDER BY table_name,index_name,seq_in_index;",db)
    data['checks']=rows("SELECT JSON_OBJECT('name',constraint_name,'clause',check_clause) FROM information_schema.check_constraints WHERE constraint_schema=DATABASE() ORDER BY constraint_name;",db)
    data['referentialActions']=rows("SELECT JSON_OBJECT('table',table_name,'name',constraint_name,'update',update_rule,'delete',delete_rule) FROM information_schema.referential_constraints WHERE constraint_schema=DATABASE() ORDER BY table_name,constraint_name;",db)
    data['triggers']=rows("SELECT JSON_OBJECT('name',trigger_name,'table',event_object_table,'timing',action_timing,'event',event_manipulation,'order',action_order,'body',action_statement) FROM information_schema.triggers WHERE trigger_schema=DATABASE() ORDER BY trigger_name;",db)
    data['routines']=rows("SELECT JSON_OBJECT('name',routine_name,'type',routine_type) FROM information_schema.routines WHERE routine_schema=DATABASE() ORDER BY routine_name;",db)
    data['events']=rows("SELECT JSON_OBJECT('name',event_name) FROM information_schema.events WHERE event_schema=DATABASE() ORDER BY event_name;",db)
    names=[r['table'] for r in data['tables']]
    require(all(re.fullmatch(r'[a-z_]+',name) for name in names),'Unexpected identifier in target')
    data['rowCounts']=rows(' UNION ALL '.join(f"SELECT JSON_OBJECT('table','{name}','rows',COUNT(*)) FROM `{name}`" for name in names)+';',db) if names else []
    return data

def split_items(body):
    result=[]; start=0; depth=0; quoted=False
    for i,ch in enumerate(body):
        if ch=="'": quoted=not quoted
        if not quoted:
            if ch=='(': depth+=1
            elif ch==')': depth-=1
            elif ch==',' and depth==0:
                result.append(body[start:i].strip()); start=i+1
    result.append(body[start:].strip())
    return result

def norm(value):
    return re.sub(r'\s+|`','',re.sub(r'_[a-zA-Z0-9]+(?=\x27)','',value)).lower()

def verify(data):
    source=SQL.read_text(encoding='utf-8')
    design=json.loads(DESIGN.read_text(encoding='utf-8'))
    definitions=dict(re.findall(r'CREATE TABLE (\w+)\s*\((.*?)\) ENGINE',source,re.S))
    require(set(definitions)==set(design['tables']),'Authored definitions must match revised design manifest')
    require(set(definitions)=={r['table'] for r in data['tables']},'Actual table set differs from revised entities/justified extensions')
    require(all(r['engine']=='InnoDB' and r['collation']=='utf8mb4_unicode_ci' for r in data['tables']),'Unexpected table engine/collation')
    require(all(r['rows']==0 for r in data['rowCounts']),'Unexpected data: must remain empty')
    require(not data['routines'] and not data['events'],'Unintended routine/event')
    keygroups={}; indexgroups={}
    for row in data['keys']: keygroups.setdefault((row['table'],row['name']),[]).append(row)
    for row in data['indexes']: indexgroups.setdefault((row['table'],row['name']),[]).append(row)
    columns={(r['table'],r['column']):r for r in data['columns']}
    expected_columns=set(); expected_fks=set(); expected_unique=set(); expected_checks=set()
    attribute_evidence=[]
    for name,body in definitions.items():
        items=split_items(body)
        primary=re.search(r'PRIMARY KEY\s*\(([^)]+)\)',body)
        if primary: pcols=[c.strip() for c in primary.group(1).split(',')]
        else:
            inline=next(x for x in items if 'PRIMARY KEY' in x)
            pcols=[inline.split()[0]]
        require([r['column'] for r in keygroups.get((name,'PRIMARY'),[])]==pcols,f'PK mismatch {name}')
        for item in items:
            if re.match(r'^(?:CONSTRAINT|FOREIGN|PRIMARY|UNIQUE|KEY)\b',item): continue
            match=re.match(r'(\w+)\s+((?:BIGINT|INT|SMALLINT|TINYINT)(?: UNSIGNED)?|VARCHAR\(\d+\)|CHAR\(\d+\)|DECIMAL\(\d+,\d+\)|ENUM\([^)]*\)|DATETIME\(3\)|DATE|TEXT|JSON|BOOLEAN)',item)
            # A boundary after ')' is not meaningful: retry with the same explicit types.
            if not match:
                match=re.match(r'(\w+)\s+(.+?)(?=\s+(?:NOT NULL|NULL|DEFAULT|PRIMARY KEY|GENERATED|CHARACTER SET)|$)',item,re.S)
            require(match is not None,f'Cannot account for authored column {name}: {item}')
            cname,ctype=match.groups(); expected_columns.add((name,cname))
            actual=columns[(name,cname)]
            expected_type='tinyint(1)' if ctype=='BOOLEAN' else ctype.lower()
            require(actual['type'].lower()==expected_type,f'Type mismatch {name}.{cname}: {actual["type"]} vs {expected_type}')
            nullable='NO' if 'NOT NULL' in item or cname in pcols else 'YES'
            require(actual['nullable']==nullable,f'Nullability mismatch {name}.{cname}')
            default=re.search(r"\bDEFAULT\s+('[^']*'|CURRENT_TIMESTAMP\(3\)|NULL|TRUE|FALSE|\d+)",item)
            expected_default=None
            if default:
                token=default.group(1)
                expected_default=None if token=='NULL' else {'TRUE':'1','FALSE':'0'}.get(token,token.strip("'").lower() if token.startswith('CURRENT_') else token.strip("'"))
            actual_default=actual['default'].lower() if isinstance(actual['default'],str) and actual['default'].upper().startswith('CURRENT_') else actual['default']
            require(actual_default==expected_default,f'Default mismatch {name}.{cname}')
            if 'AUTO_INCREMENT' in item: require('auto_increment' in actual['extra'],f'Missing auto increment {name}.{cname}')
            generated=re.search(r'GENERATED ALWAYS AS \((.*)\) STORED',item,re.S)
            if generated:
                # MySQL inserts grouping parentheses when normalizing expressions.
                # Retain actual expressions as evidence; compare their token order.
                simplify=lambda s:norm(s).replace('(','').replace(')','')
                require(simplify(actual['generated'])==simplify(generated.group(1)),f'Generated expression token mismatch {name}.{cname}')
        for unique,idx,carrier in re.findall(r'(UNIQUE\s+)?KEY\s+(\w+)\s*\(([^)]+)\)',body):
            actual=indexgroups.get((name,idx),[])
            require([r['column'] for r in actual]==[c.strip() for c in carrier.split(',')],f'Index mismatch {name}.{idx}')
            if unique:
                expected_unique.add((name,idx)); require(all(r['nonUnique']==0 for r in actual),f'Nonunique index {name}.{idx}')
        for carrier,parent,target in re.findall(r'FOREIGN KEY\s*\(([^)]+)\)\s*REFERENCES (\w+)\(([^)]+)\)',body,re.S):
            expected_fks.add((name,tuple(c.strip() for c in carrier.split(',')),parent,tuple(c.strip() for c in target.split(','))))
        expected_checks.update((name,c) for c in re.findall(r'CONSTRAINT (\w+) CHECK',body))
        attribute_evidence.append({'entity':name,'justification':design['tables'][name]['justification'],
          'revisedAttributes':design['tables'][name]['revisedAttributes'],
          'attributeResolution':design['tables'][name]['attributeResolution'],
          'actualColumns':[r['column'] for r in data['columns'] if r['table']==name],
          'columnTypesNullabilityDefaultsVerified':True})
    require(expected_columns==set(columns),'Unexpected actual column inventory')
    actual_fks={(t,tuple(r['column'] for r in k),k[0]['parent'],tuple(r['parentColumn'] for r in k))
      for (t,_),k in keygroups.items() if k[0]['parent'] is not None}
    require(expected_fks==actual_fks,'Actual FK path differs from revised design')
    require(expected_unique=={(r['table'],r['name']) for r in data['constraints'] if r['type']=='UNIQUE'},'Unique inventory mismatch')
    require(expected_checks=={(r['table'],r['name']) for r in data['constraints'] if r['type']=='CHECK' and r['enforced']=='YES'},'Enforced CHECK inventory mismatch')
    require(all(r['delete'] in ('RESTRICT','NO ACTION') and r['update'] in ('RESTRICT','NO ACTION') for r in data['referentialActions']),'Unexpected cascading history action')
    expected_triggers={t['name']:t for t in design['triggers']}
    require(set(expected_triggers)=={t['name'] for t in data['triggers']},'Trigger inventory mismatch')
    for t in data['triggers']:
        expected=expected_triggers[t['name']]
        require(all(t[k]==expected[k] for k in ('table','event','timing')),'Trigger target/event mismatch')
        require(norm(t['body'])==norm('BEGIN\n'+expected['body']+'\nEND'),'Ownership/history trigger body mismatch')
    return {'tables':len(definitions),'columns':len(columns),'primaryKeys':len(definitions),'foreignKeys':len(actual_fks),
      'uniqueConstraints':len(expected_unique),'enforcedChecks':len(expected_checks),'indexes':len(indexgroups),
      'triggers':len(data['triggers']),'rows':0,'entityAttributeVerification':attribute_evidence,
      'exactTableColumnAndKeyInventory':True,'allColumnTypesNullabilityDefaultsVerified':True,
      'allDeclaredIndexesAndReferentialActionsVerified':True,'triggerDefinitionsVerified':True}

def preserve_rejected():
    archive=OUT/'rejected-P2B001'
    archive.mkdir(exist_ok=False)
    fingerprints=[]
    for relative in ('database/phase2-bootstrap/P2B001_corrected_database_bootstrap.sql',
        'database/phase2-execution/2026-11-22-bootstrap/execution.json',
        'docs/PHASE_2_DATABASE_MIGRATION_REPORT.md','docs/PHASE_2_DATABASE_CORRECTED_ERD.md',
        'docs/PHASE_2_DATABASE_DATA_DICTIONARY.md','docs/PHASE_2_DATABASE_ERD_CORRECTION_REPORT.md'):
        path=ROOT/relative; raw=path.read_bytes()
        # Preservation only. These bytes never enter authoring/verification of new DDL.
        (archive/path.name).write_bytes(raw)
        fingerprints.append({'original':relative,'archive':str((archive/path.name).relative_to(ROOT)),
                             'sha256':hashlib.sha256(raw).hexdigest()})
    save('preserved-P2B001-fingerprints.json',fingerprints)
    return fingerprints

def finish():
    after=metadata(); save('after-metadata.json',after)
    verified=verify(after); save('entity-relationship-verification.json',verified)
    state['verification']={k:v for k,v in verified.items() if k!='entityAttributeVerification'}
    state['status']='verified'
    save('execution.json',state)
    ddl=mysql('\n'.join(f'SHOW CREATE TABLE `{r["table"]}`;' for r in after['tables']))
    (OUT/'actual-show-create-tables.txt').write_text(ddl,encoding='utf-8')
    require(identity()=={'database':DB,'version':'8.4.13','uuid':UUID},'Post-build target changed')
    require(not rows(f"SELECT JSON_OBJECT('schema',schema_name) FROM information_schema.schemata WHERE schema_name='{RESTORE}';"),'Restoration schema already exists; refuse overwrite')
    # Fresh backup ONLY AFTER correct target metadata has passed verification.
    dump_cmd='export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysqldump --protocol=socket --user=root --single-transaction --routines --events --triggers --set-gtid-purged=OFF --no-tablespaces --skip-add-drop-table --skip-dump-date --hex-blob enterflow_phase2_db'
    dump=docker(['exec',CONTAINER,'sh','-c',dump_cmd])
    require(not re.search(r'^\s*(?:USE |CREATE DATABASE|DROP DATABASE)',dump,re.M|re.I),'Backup contains schema switching statements')
    require(not re.search(r'^\s*INSERT INTO',dump,re.M|re.I),'Backup unexpectedly contains data')
    backup=OUT/'P2B002_verified_empty_schema.sql'
    with backup.open('x',encoding='utf-8',newline='\n') as stream: stream.write(dump)
    state['backup']={'file':str(backup.relative_to(ROOT)),'bytes':backup.stat().st_size,
                     'sha256':hashlib.sha256(backup.read_bytes()).hexdigest(),'createdAfterVerification':True}
    state['status']='backed_up'; save('execution.json',state)
    mysql(f'CREATE DATABASE `{RESTORE}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;')
    require(not metadata(RESTORE)['tables'],'Restoration target is not empty')
    state['restoreIdentityBefore']=identity(RESTORE)
    restore_output=mysql(dump,RESTORE)
    (OUT/'restore-output.txt').write_text(restore_output,encoding='utf-8')
    restored=metadata(RESTORE); save('restore-metadata.json',restored)
    restore_verification=verify(restored)
    # No table/schema names, generated definitions or FK expressions are rewritten.
    require(restored==after,'Restored physical schema differs from corrected target')
    state['restoration']={'database':RESTORE,'separateInitiallyEmptySchema':True,
       'metadataExactlyMatchesCorrectedTarget':True,'tables':restore_verification['tables'],'rows':0,
       'retainedForReview':True}
    state['identityAfter']=identity()
    state['status']='complete'; state['completedAt']=datetime.now(timezone(timedelta(hours=8))).isoformat()
    save('execution.json',state)

parser=argparse.ArgumentParser()
parser.add_argument('--verify-finish',action='store_true',help='Read/reverify an already applied P2B002, never rebuild')
parser.add_argument('--retry-preflight',action='store_true',help='Archive a stopped preflight only when no DDL has started')
args=parser.parse_args()
try:
    OUT.mkdir(exist_ok=True)
    guard()
    if args.verify_finish:
        require(JOURNAL.is_file(),'No P2B002 journal to resume')
        state=json.loads(JOURNAL.read_text(encoding='utf-8'))
        require(state.get('schemaCreated') and 'backup' not in state,'Resume requires applied schema before any backup/restore attempt')
        finish()
    else:
        if args.retry_preflight:
            prior=json.loads(JOURNAL.read_text(encoding='utf-8'))
            require(prior.get('status')=='stopped' and prior.get('ddlStarted') is False,'Retry forbidden after DDL or an unstopped attempt')
            archive=OUT/'preflight-attempt-01.json'
            require(not archive.exists(),'Preflight archive exists: inspect instead of overwriting')
            JOURNAL.rename(archive)
            state['priorPreflightAttempt']=str(archive.relative_to(ROOT))
            state['priorPreflightExplanation']='MySQL warning 1287 from deprecated INFORMATION_SCHEMA.PROCESSLIST, before any DDL; switched to performance_schema.processlist.'
        require(not JOURNAL.exists(),'Existing journal: inspect actual state; never blindly rerun rebuild')
        state['quiescence']=no_application()
        before=metadata(); save('before-rebuild-metadata.json',before)
        require(all(r['rows']==0 for r in before['rowCounts']),'Existing Phase 2 table contains data: rebuild forbidden')
        state['beforeTableCount']=len(before['tables']); state['allExistingTablesEmpty']=True
        preserve_rejected()
        state['bootstrap']={'file':str(SQL.relative_to(ROOT)),'sha256':hashlib.sha256(SQL.read_bytes()).hexdigest()}
        state['status']='ready'; save('execution.json',state)
        # Recheck immediately before destructive work, on this target only.
        guard(); no_application()
        require(all(r['rows']==0 for r in metadata()['rowCounts']),'Data appeared during preflight; stop')
        state['status']='rebuilding'; state['ddlStarted']=True; save('execution.json',state)
        mysql(f'DROP DATABASE `{DB}`; CREATE DATABASE `{DB}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;')
        require(not metadata()['tables'],'Recreated target is not empty')
        output=mysql(SQL.read_text(encoding='utf-8'))
        (OUT/'bootstrap-output.txt').write_text(output,encoding='utf-8')
        state['schemaCreated']=True; state['ddlExitCode']=0; state['status']='schema_created'; save('execution.json',state)
        finish()
    print(json.dumps(state,indent=2))
except Exception as exc:
    state['error']=str(exc); state['status']='stopped'
    if state.get('ddlStarted'):
        try: save('stopped-metadata.json',metadata())
        except Exception as secondary: state['inspectionError']=str(secondary)
    if not JOURNAL.exists() or state.get('ddlStarted'): save('execution.json',state)
    print(json.dumps(state,indent=2)); sys.exit(1)
