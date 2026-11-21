import { readFile } from 'node:fs/promises';
const fixture = JSON.parse(await readFile(new URL('./phase2-metadata.json', import.meta.url), 'utf8'));
// Test-only fixture decoder. Does not import any framework implementation.
export function independentMetadata(baseline, stage, withHistory) {
  const m = structuredClone(baseline);
  const addColumn = (table, tuple, position) => {
    const [column,type,nullable,def,extra,collation,generated] = tuple;
    m.columns.push({ table,column,type,nullable,default:def,extra,collation,generated,position });
  };
  const index = (table, name, cols, nonUnique) => cols.forEach((column, i) => m.indexes.push({ table,name,column,position:i+1,nonUnique,prefix:null,visibility:'YES',type:'BTREE',direction:'A',expression:null }));
  const unique = (table,name,column) => {
    m.constraints.push({ table,name,type:'UNIQUE',enforced:'YES' });
    m.keys.push({ table,name,column,position:1,parent:null,parentColumn:null });
    index(table,name,[column],0);
  };
  for (const table of [...(stage >= 1 ? ['user_sessions'] : []), ...(stage >= 2 ? ['client_applications'] : []), ...(withHistory ? ['_enterflow_phase2_extension_history'] : [])]) {
    const f = fixture[table];
    m.tables.push({ table,type:'BASE TABLE',engine:'InnoDB',collation:'utf8mb4_unicode_ci' });
    f.columns.forEach((col,i) => addColumn(table,col,i+1));
    for (const [name,type,cols,parent,parentColumn] of f.keys) {
      m.constraints.push({ table,name,type,enforced:'YES' });
      cols.forEach((column,i) => m.keys.push({ table,name,column,position:i+1,parent,parentColumn }));
      if (parent) m.referentialActions.push({ table,name,update:'RESTRICT',delete:'RESTRICT' });
    }
    f.indexes.forEach(([name,cols,nonUnique]) => index(table,name,cols,nonUnique));
    if (f.check) {
      m.constraints.push({ table,name:f.check[0],type:'CHECK',enforced:'YES' });
      m.checks.push({ name:f.check[0],clause:f.check[1] });
    }
  }
  if (stage >= 3) {
    for (const table of ['user_account','client_applications']) {
      // Both reviewed schemas place email fourth; username must be fifth.
      m.columns.filter(c => c.table === table && c.position >= 5).forEach(c => c.position++);
      addColumn(table,fixture.username[table],5);
      unique(table,table === 'user_account' ? 'uq_user_account_username' : 'uq_client_application_active_username',table === 'user_account' ? 'username' : 'active_username');
    }
    addColumn('client_applications',fixture.username.active,16);
  }
  return m;
}
