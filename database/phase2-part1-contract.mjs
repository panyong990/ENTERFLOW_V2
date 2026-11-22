// Reviewed Part 1 extension contract. No I/O and no database execution on import.
export const part1Names = ['004_client_requests.sql','005_proof_of_payment.sql','006_request_target_history.sql'];
export const poRequestTrigger={name:'purchase_order_request_history',table:'purchase_order',timing:'BEFORE',event:'UPDATE',body:"BEGIN\nIF NEW.quotation_id<>OLD.quotation_id AND EXISTS(SELECT 1 FROM cancellation_request WHERE po_id=OLD.po_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Requested PO quotation is historical'; END IF;\nEND"};
export const renameSql = 'RENAME TABLE client_receipt TO proof_of_payment, client_receipt_file TO proof_of_payment_file';
export const requestSpecs = [
  {table:'cancellation_request',target:'inquiry_id',parent:'inquiry',parentKey:'inquiry_id',prefix:'cancel'},
  {table:'quotation_revision_request',target:'quotation_id',parent:'quotation',parentKey:'quotation_id',prefix:'revision'},
];
const idType='bigint unsigned';
export function requestColumns(s) {
  return [
    ['request_id',idType,'NO','auto_increment'],[s.target,idType],
    ...(s.prefix==='cancel' ? [['quotation_id',idType,'YES'],['po_id',idType,'YES']] : []),
    ['requested_by_client_user_id',idType],['reason','text'],
    ['status',"enum('pending','approved','rejected')",'NO','','pending'],
    ['submitted_at','datetime(3)','NO','DEFAULT_GENERATED','CURRENT_TIMESTAMP(3)'],
    ['reviewed_by_user_id',idType,'YES'],['reviewed_at','datetime(3)','YES'],['review_note','text','YES'],
    ['pending_target_id',idType,'YES','STORED GENERATED',null,`(case when (\`status\` = _utf8mb4'pending') then \`${s.target}\` else NULL end)`],
  ];
}
export function requestChecks(s) {
  return [
    ['reason','(char_length(trim(`reason`)) > 0)'],
    ['review',"(((`status` = _utf8mb4'pending') and (`reviewed_by_user_id` is null) and (`reviewed_at` is null)) or ((`status` in (_utf8mb4'approved',_utf8mb4'rejected')) and (`reviewed_by_user_id` is not null) and (`reviewed_at` is not null)))"],
    ['review_date','((`reviewed_at` is null) or (`reviewed_at` >= `submitted_at`))'],
    ['rejection',"((`status` <> _utf8mb4'rejected') or ((`review_note` is not null) and (char_length(trim(`review_note`)) > 0)))"],
    ...(s.prefix==='cancel' ? [['target','((`quotation_id` is null) or (`po_id` is null))']] : []),
  ];
}
export function requestForeignKeys(s) {
  return [
    [s.target,s.parent,s.parentKey],
    ...(s.prefix==='cancel' ? [['quotation_id','quotation','quotation_id'],['po_id','purchase_order','po_id']] : []),
    ['requested_by_client_user_id','client_user','client_user_id'],['reviewed_by_user_id','user_account','user_id'],
  ];
}
export const requestTriggers=[];
for (const s of requestSpecs) for (const event of ['INSERT','UPDATE']) {
  const inquiry = s.prefix==='cancel' ? 'NEW.inquiry_id' : '(SELECT inquiry_id FROM quotation WHERE quotation_id=NEW.quotation_id)';
  const ownership=`IF (SELECT client_id FROM inquiry WHERE inquiry_id=${inquiry})<>(SELECT client_id FROM client_user WHERE client_user_id=NEW.requested_by_client_user_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Request submitter must own inquiry'; END IF;`;
  const update=event==='UPDATE' ? `IF OLD.status<>'pending' OR NEW.${s.target}<>OLD.${s.target} OR NEW.requested_by_client_user_id<>OLD.requested_by_client_user_id OR NEW.reason<>OLD.reason OR NEW.submitted_at<>OLD.submitted_at${s.prefix==='cancel' ? ' OR NOT(NEW.quotation_id<=>OLD.quotation_id) OR NOT(NEW.po_id<=>OLD.po_id)' : ''} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Request identity and decided history are immutable'; END IF;` : "IF NEW.status<>'pending' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Request must start pending'; END IF;";
  const reviewer="IF NEW.reviewed_by_user_id IS NOT NULL AND COALESCE((SELECT r.role_name FROM user_account u JOIN role r ON r.role_id=u.role_id WHERE u.user_id=NEW.reviewed_by_user_id AND u.status='active'),'')<>'Sales' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Request reviewer must have active Sales role'; END IF;";
  const eligibility=s.prefix==='cancel' ? `IF (NEW.status='pending' OR NEW.status='approved') AND (EXISTS(SELECT 1 FROM job_order j JOIN purchase_order p ON p.po_id=j.po_id JOIN quotation q ON q.quotation_id=p.quotation_id WHERE q.inquiry_id=NEW.inquiry_id) OR EXISTS(SELECT 1 FROM payment_transaction t JOIN sales_invoice v ON v.invoice_id=t.invoice_id JOIN purchase_order p ON p.po_id=v.po_id JOIN quotation q ON q.quotation_id=p.quotation_id WHERE q.inquiry_id=NEW.inquiry_id AND t.transaction_type='DOWNPAYMENT' AND t.approval_status='approved')) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cancellation blocked after JO or confirmed downpayment'; END IF;
IF NEW.quotation_id IS NOT NULL AND NEW.inquiry_id<>(SELECT inquiry_id FROM quotation WHERE quotation_id=NEW.quotation_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cancellation quotation must belong to inquiry'; END IF;
IF NEW.po_id IS NOT NULL AND NEW.inquiry_id<>(SELECT q.inquiry_id FROM purchase_order p JOIN quotation q ON q.quotation_id=p.quotation_id WHERE p.po_id=NEW.po_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cancellation PO must belong to inquiry'; END IF;` : `IF NEW.status='pending' AND ((SELECT is_current FROM quotation WHERE quotation_id=NEW.quotation_id)<>1 OR (SELECT status FROM quotation WHERE quotation_id=NEW.quotation_id)<>'sent' OR EXISTS(SELECT 1 FROM purchase_order WHERE quotation_id=NEW.quotation_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Revision requires current sent quotation before PO'; END IF;`;
  requestTriggers.push({name:`${s.prefix}_request_${event==='INSERT'?'bi':'bu'}`,table:s.table,timing:'BEFORE',event,body:`BEGIN\n${update}\n${ownership}\n${reviewer}\n${eligibility}\nEND`});
}
requestTriggers.push(
  {name:'inquiry_request_owner_history',table:'inquiry',timing:'BEFORE',event:'UPDATE',body:"BEGIN\nIF NEW.client_id<>OLD.client_id AND EXISTS(SELECT 1 FROM cancellation_request WHERE inquiry_id=OLD.inquiry_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Request inquiry ownership is historical'; END IF;\nEND"},
  {name:'quotation_request_history',table:'quotation',timing:'BEFORE',event:'UPDATE',body:"BEGIN\nIF (NEW.inquiry_id<>OLD.inquiry_id OR NEW.revision_no<>OLD.revision_no) AND (EXISTS(SELECT 1 FROM quotation_revision_request WHERE quotation_id=OLD.quotation_id) OR EXISTS(SELECT 1 FROM cancellation_request WHERE quotation_id=OLD.quotation_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Requested quotation revision is historical'; END IF;\nEND"},
  {name:'client_user_request_history',table:'client_user',timing:'BEFORE',event:'UPDATE',body:"BEGIN\nIF NEW.client_id<>OLD.client_id AND (EXISTS(SELECT 1 FROM cancellation_request WHERE requested_by_client_user_id=OLD.client_user_id) OR EXISTS(SELECT 1 FROM quotation_revision_request WHERE requested_by_client_user_id=OLD.client_user_id)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Request client ownership is historical'; END IF;\nEND"},
);
export function triggerSql(t) {return `CREATE TRIGGER ${t.name} ${t.timing} ${t.event} ON ${t.table} FOR EACH ROW\n${t.body}`;}
export function workflowStatements() {
  return [...requestSpecs.map(s=>{
    const columns=requestColumns(s).map(([name,type,nullable='NO',extra='',def=null,generated=''])=>
      `${name} ${type}${generated ? ` GENERATED ALWAYS AS ${generated} STORED` : ` ${nullable==='YES'?'NULL':'NOT NULL'}${extra==='auto_increment'?' AUTO_INCREMENT':''}${def!==null ? ` DEFAULT ${extra==='DEFAULT_GENERATED'?def:`'${def}'`}`:''}`}`);
    const keys=[`PRIMARY KEY (request_id)`,`UNIQUE KEY uq_${s.prefix}_pending (pending_target_id)`,
      `KEY ix_${s.prefix}_target (${s.target},submitted_at)`,`KEY ix_${s.prefix}_client_history (requested_by_client_user_id,status,submitted_at,request_id)`,
      `KEY ix_${s.prefix}_queue (status,submitted_at,request_id)`,`KEY ix_${s.prefix}_reviewer (reviewed_by_user_id,reviewed_at)`];
    if(s.prefix==='cancel') keys.push('KEY ix_cancel_quotation (quotation_id)','KEY ix_cancel_po (po_id)');
    const fks=requestForeignKeys(s).map(([c,p,pc])=>`CONSTRAINT fk_${s.prefix}_${c} FOREIGN KEY (${c}) REFERENCES ${p}(${pc})`);
    const checks=requestChecks(s).map(([n,clause])=>`CONSTRAINT ck_${s.prefix}_${n} CHECK ${clause}`);
    return `CREATE TABLE ${s.table} (\n  ${[...columns,...keys,...fks,...checks].join(',\n  ')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
  }),...requestTriggers.map(triggerSql)];
}
export function proofStatements(baseline) {
  const replacement=baseline.triggers.filter(t=>['sales_invoice_po_id_history','client_user_client_id_history'].includes(t.name))
    .map(t=>({...t,name:t.name+'_p2',body:t.body.replaceAll('client_receipt','proof_of_payment')}));
  return [...replacement.map(triggerSql),renameSql,...replacement.map(t=>`DROP TRIGGER ${t.name.slice(0,-3)}`)];
}
// SQL files use explicit markers so compound trigger bodies remain one command.
// Only fixed manifest files with reviewed checksums can reach this parser.
export function splitPart1Sql(text) {
  const statements=text.split(/^-- @statement\s*$/m).map(s=>s.replace(/^--[^\r\n]*\r?\n/gm,'').trim()).filter(Boolean);
  for(const sql of statements) if(!/^(CREATE TABLE|CREATE TRIGGER|DROP TRIGGER|RENAME TABLE)\b/.test(sql)) throw new Error('Unsupported Part 1 statement');
  return statements.map(s=>s.endsWith(';')?s.slice(0,-1):s);
}
export function extendPart1Metadata(m,stage,{table,column,key,index}) {
  if(stage>=4) {
    for(const s of requestSpecs) {
      table(s.table);
      for(const [name,type,nullable,extra,def,generated] of requestColumns(s)) column(s.table,name,type,nullable,extra,def,generated);
      key(s.table,'PRIMARY',['request_id'],'PRIMARY KEY'); key(s.table,`uq_${s.prefix}_pending`,['pending_target_id']);
      index(s.table,`ix_${s.prefix}_target`,[s.target,'submitted_at']);
      index(s.table,`ix_${s.prefix}_client_history`,['requested_by_client_user_id','status','submitted_at','request_id']);
      index(s.table,`ix_${s.prefix}_queue`,['status','submitted_at','request_id']);
      index(s.table,`ix_${s.prefix}_reviewer`,['reviewed_by_user_id','reviewed_at']);
      if(s.prefix==='cancel') {index(s.table,'ix_cancel_quotation',['quotation_id']);index(s.table,'ix_cancel_po',['po_id']);}
      for(const [c,p,pc] of requestForeignKeys(s)) key(s.table,`fk_${s.prefix}_${c}`,[c],'FOREIGN KEY',p,pc);
      for(const [n,clause] of requestChecks(s)) {const name=`ck_${s.prefix}_${n}`;m.constraints.push({table:s.table,name,type:'CHECK',enforced:'YES'});m.checks.push({name,clause});}
    }
    for(const t of requestTriggers) m.triggers.push({...t,order:m.triggers.filter(r=>r.table===t.table&&r.timing===t.timing&&r.event===t.event).length+1});
  }
  if(stage>=5) {
    for(const original of ['sales_invoice_po_id_history','client_user_client_id_history']) {
      const old=m.triggers.find(t=>t.name===original);m.triggers=m.triggers.filter(t=>t!==old);
      for(const t of m.triggers) if(t.table===old.table&&t.timing===old.timing&&t.event===old.event&&t.order>old.order) t.order--;
      m.triggers.push({...old,name:original+'_p2',body:old.body.replaceAll('client_receipt','proof_of_payment'),order:m.triggers.filter(t=>t.table===old.table&&t.timing===old.timing&&t.event===old.event).length+1});
    }
    const rename={client_receipt:'proof_of_payment',client_receipt_file:'proof_of_payment_file'};
    for(const rows of Object.values(m)) for(const row of rows) {
      for(const [old,next] of Object.entries(rename)) {
        if(row.table===old) row.table=next;if(row.parent===old) row.parent=next;
        if(row.name?.startsWith(old+'_ibfk_')) row.name=next+row.name.slice(old.length);
      }
    }
  }
  if(stage>=6) {const t=poRequestTrigger;m.triggers.push({...t,order:m.triggers.filter(r=>r.table===t.table&&r.timing===t.timing&&r.event===t.event).length+1});}
  return m;
}
