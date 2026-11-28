import { randomUUID, createHash } from 'node:crypto';
import { currentRequestId } from '../config/request-context.js';
export const ok = data => ({
  success: true,
  data
});
export const fail = (code, errors) => ({
  success: false,
  code,
  ...(errors ? {
    errors
  } : {})
});
export class BusinessError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
    this.business = true;
  }
}
export function requireThat(condition, code = 'VALIDATION_ERROR') {
  if (!condition) throw new BusinessError(code);
}
export function id(value) {
  return typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value) && BigInt(value) <= 18446744073709551615n;
}
export function text(value, max = 5000, required = true) {
  requireThat(typeof value === 'string' && value.isWellFormed() && value.length <= max && (!required || value.trim().length > 0));
  return value.trim();
}
export function object(value, allowed) {
  requireThat(value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
  const descriptors = Object.getOwnPropertyDescriptors(value);
  requireThat(Reflect.ownKeys(descriptors).every(k => typeof k === 'string' && allowed.includes(k) && Object.hasOwn(descriptors[k], 'value')));
  return value;
}
export function paymentTerm(value) {
  requireThat(['NET15', 'NET30'].includes(value));
  return value;
}
export const paymentTermLabel = code => ({
  NET15: '15-Day Terms',
  NET30: '30-Day Terms'
})[code] ?? null;
export function date(value) {
  const s = value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString().slice(0, 10) : value;
  requireThat(typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s));
  const parsed = new Date(s + 'T00:00:00Z');
  requireThat(!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === s);
  return s;
}
export const reference = prefix => `${prefix}-${randomUUID()}`;
export function revision(row) {
  return createHash('sha256').update(JSON.stringify(row)).digest('hex');
}
export function inquiryRevision(order, requests = []) {
  return revision({
    id: order.id,
    status: order.status ?? order.stageCode,
    updatedAt: order.updatedAt,
    requests: requests.filter(r => (r.status ?? r.resolution) === 'pending').map(r => ({
      id: String(r.id ?? r.request_id),
      reason: r.reason
    })).sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0)
  });
}
export function paging(query = {}) {
  const page = Number(query.page ?? 1),
    pageSize = Number(query.pageSize ?? query.limit ?? 25);
  requireThat(Number.isInteger(page) && page > 0 && page <= 100000 && Number.isInteger(pageSize) && pageSize > 0 && pageSize <= 100);
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize
  };
}
export function decimal(value, scale = 4) {
  requireThat(['string', 'number'].includes(typeof value) && /^\d{1,17}(?:\.\d{1,8})?$/.test(String(value)));
  const [a, b = ''] = String(value).split('.');
  requireThat(b.length <= scale);
  return BigInt(a) * 10n ** BigInt(scale) + BigInt(b.padEnd(scale, '0'));
}
export function format(n, scale = 4) {
  const sign = n < 0n ? '-' : '';
  n = n < 0n ? -n : n;
  const s = n.toString().padStart(scale + 1, '0');
  return scale ? `${sign}${s.slice(0, -scale)}.${s.slice(-scale)}` : sign + s;
}
export function rounded(n, denominator) {
  return (n + denominator / 2n) / denominator;
}
export const multiply = (a, b) => rounded(a * b, 10000n);
export const money = n => format(rounded(n, 100n), 2);
export function validDownpayment(percent, amount, total) {
  try {
    return [20, 50].includes(Number(percent)) && decimal(amount, 2) === rounded(decimal(total, 2) * BigInt(Number(percent)), 100n);
  } catch {
    return false;
  }
}
export async function rows(c, sql, params = []) {
  const [result] = await c.execute(sql, params);
  return result;
}
export async function one(c, sql, params = []) {
  return (await rows(c, sql, params))[0] ?? null;
}
export async function insert(c, sql, params = []) {
  const r = await rows(c, sql, params);
  requireThat(r.affectedRows === 1 && !r.warningStatus && id(String(r.insertId)) && (typeof r.insertId !== 'number' || Number.isSafeInteger(r.insertId)), 'SERVICE_UNAVAILABLE');
  return String(r.insertId);
}
export async function changed(c, sql, params = []) {
  const r = await rows(c, sql, params);
  requireThat(r.affectedRows === 1 && !r.warningStatus, 'STALE_RECORD');
  return r;
}
export async function read(db, work, onError) {
  let c;
  try {
    c = await db.getConnection();
    return await work(c);
  } catch (e) {
    if (!e?.business && onError) try { onError(e); } catch { /* Diagnostics cannot alter results. */ }
    return failure(e);
  } finally {
    c?.release();
  }
}
export function failure(e) {
  if (e?.business) return fail(e.code);
  if (e?.code === 'ER_DUP_ENTRY') return fail('CONFLICT');
  if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(e?.code)) return fail('CONFLICT');
  return fail('SERVICE_UNAVAILABLE');
}
export async function transaction(db, actor, roles, work, {
  identityLock = false,
  diagnostics
} = {}) {
  const stage = value => { try { diagnostics?.stage(value); } catch { /* Diagnostics cannot alter results. */ } };
  let c,
    open = false,
    commitAttempted = false,
    destroy = false,
    lockName;
  try {
    if (!actor || !id(actor.userId) || !roles.includes(actor.roleCode) || actor.accountType !== (actor.roleCode === 'client' ? 'client' : 'employee')) return fail('FORBIDDEN');
    stage('connection_acquire');
    c = await db.getConnection();
    if (identityLock) {
      const selected = await one(c, 'SELECT DATABASE() AS databaseName');
      lockName = 'enterflow:identity:' + createHash('sha256').update(selected.databaseName).digest('hex').slice(0, 40);
      const acquired = await one(c, 'SELECT GET_LOCK(?,2) AS acquired', [lockName]);
      if (Number(acquired?.acquired) !== 1) {
        destroy = true;
        throw new BusinessError('CONFLICT');
      }
    }
    stage('transaction_begin');
    await c.beginTransaction();
    open = true;
    stage('user_identity_lookup');
    const identity = {
      ...(await authorize(c, actor, roles)),
      requestId: currentRequestId() ?? actor?.requestId ?? randomUUID()
    };
    const result = await work(c, identity);
    if (result?.success === false) return result;
    commitAttempted = true;
    stage('transaction_commit');
    await c.commit();
    open = false;
    return result?.success === true ? result : ok(result);
  } catch (e) {
    try { diagnostics?.error(e); } catch { /* Preserve the original failure and rollback. */ }
    if (commitAttempted) {
      destroy = true;
      return fail('WRITE_OUTCOME_UNKNOWN');
    }
    return failure(e);
  } finally {
    if (open && c) try {
      await c.rollback();
    } catch (e) {
      try { diagnostics?.error(e, 'transaction_rollback'); } catch { /* Preserve the original failure. */ }
      destroy = true;
    }
    if (lockName && c) try {
      const released = await one(c, 'SELECT RELEASE_LOCK(?) AS released', [lockName]);
      if (Number(released?.released) !== 1) destroy = true;
    } catch {
      destroy = true;
    }
    if (c) {
      if (destroy) c.destroy();else c.release();
    }
  }
}
export async function authorize(c, actor, roles) {
  requireThat(actor && id(actor.userId) && roles.includes(actor.roleCode), 'FORBIDDEN');
  const user = await one(c, `SELECT CAST(u.user_id AS CHAR) userId,LOWER(r.role_name) roleCode,u.status,u.must_change_password mustChangePassword,
    CAST(cu.client_id AS CHAR) clientId,cl.status clientStatus FROM user_account u JOIN role r ON r.role_id=u.role_id
    LEFT JOIN client_user cu ON cu.client_user_id=u.user_id LEFT JOIN client cl ON cl.client_id=cu.client_id WHERE u.user_id=? FOR SHARE`, [actor.userId]);
  requireThat(user && user.status === 'active' && user.roleCode === actor.roleCode, 'FORBIDDEN');
  requireThat(!Number(user.mustChangePassword), 'PASSWORD_CHANGE_REQUIRED');
  const client = user.roleCode === 'client';
  requireThat(client ? actor.accountType === 'client' && id(user.clientId) && actor.clientId === user.clientId && user.clientStatus === 'active' : actor.accountType === 'employee' && !user.clientId, 'FORBIDDEN');
  return {
    ...user,
    accountType: client ? 'client' : 'employee'
  };
}
export async function lockInquiry(c, inquiryId, clientId) {
  requireThat(id(inquiryId));
  const i = await one(c, `SELECT CAST(inquiry_id AS CHAR) id,CAST(client_id AS CHAR) clientId,inquiry_no reference,status,payment_terms paymentTermCode,contact_person contactPerson,updated_at updatedAt FROM inquiry WHERE inquiry_id=?${clientId ? ' AND client_id=?' : ''} FOR UPDATE`, clientId ? [inquiryId, clientId] : [inquiryId]);
  requireThat(i, 'NOT_FOUND');
  return i;
}
export async function inquiryFor(c, table, key, targetId) {
  const paths = {
    sales_invoice: `SELECT CAST(q.inquiry_id AS CHAR) id FROM sales_invoice v JOIN purchase_order p ON p.po_id=v.po_id JOIN quotation q ON q.quotation_id=p.quotation_id WHERE v.invoice_id=?`,
    proof_of_payment: `SELECT CAST(q.inquiry_id AS CHAR) id FROM proof_of_payment r JOIN sales_invoice v ON v.invoice_id=r.invoice_id JOIN purchase_order p ON p.po_id=v.po_id JOIN quotation q ON q.quotation_id=p.quotation_id WHERE r.receipt_id=?`,
    job_order: `SELECT CAST(q.inquiry_id AS CHAR) id FROM job_order j JOIN purchase_order p ON p.po_id=j.po_id JOIN quotation q ON q.quotation_id=p.quotation_id WHERE j.jo_id=?`,
    delivery: `SELECT CAST(q.inquiry_id AS CHAR) id FROM delivery d JOIN job_order j ON j.jo_id=d.jo_id JOIN purchase_order p ON p.po_id=j.po_id JOIN quotation q ON q.quotation_id=p.quotation_id WHERE d.delivery_id=?`
  };
  requireThat(paths[table] && id(targetId));
  const row = await one(c, paths[table], [targetId]);
  requireThat(row, 'NOT_FOUND');
  return row.id;
}
export async function audit(c, actor, action, type, subject, before, after, reason = null) {
  const value = after == null ? null : {
    ...after,
    ...(actor.requestId ? {
      requestId: actor.requestId
    } : {})
  };
  return insert(c, `INSERT INTO audit_event(actor_user_id,action,subject_type,subject_id,before_value,after_value,reason) VALUES (?,?,?,?,?,?,?)`, [actor.userId, action, type, subject, before == null ? null : JSON.stringify(before), value == null ? null : JSON.stringify(value), reason]);
}
export async function notify(c, userId, title, message, type) {
  return insert(c, 'INSERT INTO notification(user_id,title,message,notification_type) VALUES (?,?,?,?)', [userId, title, message, type]);
}
export async function notifyClient(c, clientId, title, message, type) {
  const recipient = await one(c, 'SELECT CAST(client_user_id AS CHAR) id FROM client_user WHERE client_id=?', [clientId]);
  if (recipient) {
    await notify(c, recipient.id, title, message, type);
    return true;
  }
  return false;
}
export async function notifyRole(c, roleCode, title, message, type) {
  requireThat(['sales', 'production', 'warehouse', 'logistics', 'accounting'].includes(roleCode));
  const recipients = await rows(c, "SELECT CAST(u.user_id AS CHAR) id FROM user_account u JOIN role r ON r.role_id=u.role_id WHERE LOWER(r.role_name)=? AND u.status='active' AND NOT EXISTS(SELECT 1 FROM client_user cu WHERE cu.client_user_id=u.user_id)", [roleCode]);
  for (const recipient of recipients) await notify(c, recipient.id, title, message, type);
}
export async function cancellationEligible(c, inquiry) {
  requireThat(!['cancelled', 'rejected', 'archived'].includes(inquiry.status), 'CANCELLATION_NOT_ELIGIBLE');
  const blocked = await one(c, `SELECT (EXISTS(SELECT 1 FROM job_order j JOIN purchase_order p ON p.po_id=j.po_id JOIN quotation q ON q.quotation_id=p.quotation_id WHERE q.inquiry_id=?) OR EXISTS(SELECT 1 FROM payment_transaction t JOIN sales_invoice v ON v.invoice_id=t.invoice_id JOIN purchase_order p ON p.po_id=v.po_id JOIN quotation q ON q.quotation_id=p.quotation_id WHERE q.inquiry_id=? AND t.transaction_type='DOWNPAYMENT' AND t.approval_status='approved')) blocked`, [inquiry.id, inquiry.id]);
  requireThat(!Number(blocked.blocked), 'CANCELLATION_NOT_ELIGIBLE');
}
