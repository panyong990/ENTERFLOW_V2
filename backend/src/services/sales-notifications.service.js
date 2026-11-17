import { validateSalesNotificationListQuery } from '../validation/sales-notifications.validation.js';
import { validateApplicationId } from '../validation/client-applications.validation.js';

// Called with the business transaction's connection; no separate commit or delivery.
export async function recordInquiryRejectionNotification(connection, order, actorId, reason) {
  const [recipients] = await connection.execute(`SELECT CAST(id AS CHAR) id, account_type accountType
    FROM users WHERE active=TRUE AND ((account_type='client' AND role_code='client' AND client_id=?)
      OR (account_type='employee' AND role_code='sales')) ORDER BY id FOR SHARE`, [order.clientId]);
  const ids = [...new Set(recipients.map(row => row.id))];
  const clientRecipientAvailable = recipients.some(row => row.accountType === 'client');
  const [event] = await connection.execute(`INSERT INTO notifications
    (department,title,body,order_id,client_id,created_by) VALUES ('sales',?,?,?,?,?)`,
  [`Inquiry rejected: ${order.reference}`, reason, order.id, order.clientId, actorId]);
  if (event.affectedRows !== 1 || event.warningStatus || event.insertId == null) throw new Error('Notification write failed.');
  if (typeof event.insertId==='number' && !Number.isSafeInteger(event.insertId)) throw new Error('Unsafe notification identifier.');
  const notificationId = String(event.insertId);
  if (!validateApplicationId(notificationId).success) throw new Error('Invalid notification identifier.');
  for (const userId of ids) {
    const [row] = await connection.execute('INSERT INTO notification_recipients (notification_id,user_id) VALUES (?,?)', [notificationId, userId]);
    if (row.affectedRows !== 1 || row.warningStatus) throw new Error('Notification recipient write failed.');
  }
  return { notificationId, recipientCount: ids.length, clientRecipientAvailable };
}

async function withConnection(db, work) {
  const connection = await db.getConnection();
  try { return await work(connection); } finally { connection.release(); }
}

export function createSalesNotificationsService({ db }) {
  if (!db || typeof db.getConnection !== 'function') throw new TypeError('A database pool is required.');

  async function list(userId, query) {
    const validation = validateSalesNotificationListQuery(query);
    if (!validation.success) return validation;
    const input = validation.data;
    if (typeof userId !== 'string' || !/^[1-9][0-9]{0,19}$/.test(userId)) {
      return { success: false, code: 'SERVICE_UNAVAILABLE' };
    }
    return withConnection(db, async connection => {
      const where = ['nr.user_id=?', 'nr.dismissed_at IS NULL'];
      const parameters = [userId];
      if (input.status === 'read') where.push('nr.read_at IS NOT NULL');
      if (input.status === 'unread') where.push('nr.read_at IS NULL');
      if (input.q) {
        where.push('(LOCATE(?, n.title)>0 OR LOCATE(?, n.body)>0 OR LOCATE(?, n.department)>0 OR LOCATE(?, COALESCE(n.module_code, \'\'))>0)');
        parameters.push(input.q, input.q, input.q, input.q);
      }
      const from = 'notifications n JOIN notification_recipients nr ON nr.notification_id=n.id';
      const [[count]] = await connection.execute(`SELECT COUNT(*) total FROM ${from} WHERE ${where.join(' AND ')}`, parameters);
      const total = Number(count.total);
      const page = Math.min(input.page, Math.max(1, Math.ceil(total / input.pageSize)));
      const direction = input.sort === 'created-asc' ? 'ASC' : 'DESC';
      const [rows] = await connection.execute(`SELECT CAST(n.id AS CHAR) id, n.department category, n.title,
        n.body message, n.module_code type, CAST(n.order_id AS CHAR) orderId, CAST(n.client_id AS CHAR) clientId,
        DATE_FORMAT(n.created_at, '%Y-%m-%dT%H:%i:%s.%fZ') createdAt,
        DATE_FORMAT(nr.read_at, '%Y-%m-%dT%H:%i:%s.%fZ') readAt,
        (nr.read_at IS NOT NULL) isRead FROM ${from} WHERE ${where.join(' AND ')}
        ORDER BY n.created_at ${direction}, n.id ${direction} LIMIT ? OFFSET ?`,
        [...parameters, String(input.pageSize), String((page - 1) * input.pageSize)]);
      return {
        success: true,
        data: {
          items: rows.map(row => ({
            id: row.id, category: row.category, title: row.title, message: row.message,
            type: row.type, orderId: row.orderId, clientId: row.clientId,
            createdAt: row.createdAt, readAt: row.readAt, isRead: Boolean(Number(row.isRead))
          })),
          total,
          page,
          pageSize: input.pageSize
        }
      };
    });
  }

  async function markRead(userId, notificationId) {
    if (typeof userId !== 'string' || !/^[1-9][0-9]{0,19}$/.test(userId) ||
        !validateApplicationId(notificationId).success) {
      return { success: false, code: 'VALIDATION_ERROR', errors: { id: 'Invalid notification identifier.' } };
    }
    return withConnection(db, async connection => {
      const [recipients] = await connection.execute(
        'SELECT notification_id FROM notification_recipients WHERE notification_id=? AND user_id=?',
        [notificationId, userId]
      );
      if (!recipients.length) return { success: false, code: 'NOT_FOUND' };
      const [result] = await connection.execute(
        'UPDATE notification_recipients SET read_at=COALESCE(read_at, CURRENT_TIMESTAMP(3)) WHERE notification_id=? AND user_id=?',
        [notificationId, userId]
      );
      if (result.affectedRows !== 1 && result.affectedRows !== 0) return { success: false, code: 'SERVICE_UNAVAILABLE' };
      return { success: true, data: { notificationId, isRead: true } };
    });
  }

  return { list, markRead };
}
