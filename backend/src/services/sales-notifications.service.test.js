import test from 'node:test';
import assert from 'node:assert/strict';
import { createSalesNotificationsService } from './sales-notifications.service.js';

function database({ rows = [], total = rows.length } = {}) {
  const calls = [];
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT COUNT(*)')) return [[{ total }]];
      return [rows];
    },
    release() {}
  };
  return { db: { async getConnection() { return connection; } }, calls };
}

const rows = [
  { id: '9007199254740993', category: 'sales', title: 'New inquiry', message: 'INQ-1', type: 'sales', orderId: '8', clientId: '4', createdAt: '2026-01-01T00:00:00.000000Z', readAt: null, isRead: 0 },
  { id: '9007199254740994', category: 'sales', title: 'Quotation sent', message: 'Q-1', type: 'sales', orderId: null, clientId: null, createdAt: '2026-01-02T00:00:00.000000Z', readAt: '2026-01-02T00:00:00.000000Z', isRead: 1 }
];

test('notification list is user-scoped, uses the per-user table, preserves IDs, and returns read state', async () => {
  const h = database({ rows });
  const result = await createSalesNotificationsService(h).list('71', { status: 'all', sort: 'created-desc', pageSize: '10' });
  assert.equal(result.success, true);
  assert.equal(result.data.items[0].id, '9007199254740993');
  assert.equal(result.data.items[0].isRead, false);
  assert.equal(result.data.items[1].isRead, true);
  assert.match(h.calls[0].sql, /user_id=\?/);
  assert.doesNotMatch(h.calls[0].sql,/notification_recipients|dismissed_at/);
  assert.doesNotMatch(h.calls[0].sql, /notification_roles/);
  assert.deepEqual(h.calls[0].params, ['71']);
});

test('notification list supports filtering, stable pagination, sorting, and duplicate-free joins', async () => {
  const h = database({ rows: [rows[0]], total: 25 });
  const result = await createSalesNotificationsService(h).list('71', { q: 'inquiry', status: 'unread', sort: 'created-asc', page: '2', pageSize: '10' });
  assert.equal(result.data.items.length, 1);
  assert.equal(result.data.total, 25);
  assert.equal(result.data.page, 2);
  assert.deepEqual(h.calls[1].params.slice(-2), ['10', '10']);
  assert.match(h.calls[1].sql, /ORDER BY created_at ASC,notification_id ASC/);
  assert.doesNotMatch(h.calls[1].sql, /JOIN notification_roles/);
});

test('empty notification results are safe and reads never issue mutations', async () => {
  const h = database({ rows: [], total: 0 });
  const result = await createSalesNotificationsService(h).list('71', {});
  assert.deepEqual(result.data.items, []);
  assert.equal(h.calls.some(call => /\b(INSERT|UPDATE|DELETE)\b/i.test(call.sql)), false);
});

test('invalid authenticated IDs and unsupported query fields fail before SQL', async () => {
  const h = database();
  assert.equal((await createSalesNotificationsService(h).list('0', {})).code, 'FORBIDDEN');
  assert.equal((await createSalesNotificationsService(h).list('71', { userId: '8' })).code, 'VALIDATION_ERROR');
  assert.equal(h.calls.length, 0);
});

test('markRead updates only the authenticated user recipient and preserves existing read state', async () => {
  const calls = [];
  const db = { async getConnection() {
    return {
      async execute(sql, params) {
        calls.push({ sql, params });
        if (sql.startsWith('SELECT notification_id')) return [[{ notification_id: '9007199254740993' }]];
        return [{ affectedRows: 1 }];
      },
      release() {}
    };
  } };
  const result = await createSalesNotificationsService({ db }).markRead('71', '9007199254740993');
  assert.deepEqual(result, { success: true, data: { notificationId: '9007199254740993', isRead: true } });
  assert.match(calls[0].sql, /notification_id=\? AND user_id=\?/);
  assert.match(calls[0].sql,/read_at=COALESCE/);
  assert.deepEqual(calls[0].params, ['9007199254740993', '71']);
  assert.doesNotMatch(calls[0].sql, /dismissed_at/);
});

test('markRead returns not found for another user or missing recipient without updating', async () => {
  const calls = [];
  const db = { async getConnection() {
    return { async execute(sql, params) { calls.push({ sql, params }); return [[]]; }, release() {} };
  } };
  const result = await createSalesNotificationsService({ db }).markRead('72', '9007199254740993');
  assert.deepEqual(result, { success: false, code: 'NOT_FOUND' });
  assert.equal(calls.length, 1);
});
