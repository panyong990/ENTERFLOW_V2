import { ok, read, rows, id, paging, requireThat, notify, object } from './core.js';
export async function recordInquiryRejectionNotification(c, order, actorId, reason) {
  const [r] = await c.execute('SELECT CAST(client_user_id AS CHAR) id FROM client_user WHERE client_id=?', [order.clientId]);
  if (r[0]) await notify(c, r[0].id, 'Inquiry rejected', reason, 'inquiry');
}
export function createSalesNotificationsService({
  db
}) {
  return {
    list: (userId, query = {}) => read(db, async c => {
      requireThat(id(userId), 'FORBIDDEN');
      object(query, ['page', 'pageSize', 'limit', 'unread', 'status', 'q', 'sort']);
      requireThat(query.unread === undefined || ['true', 'false', true, false].includes(query.unread));
      requireThat(query.status === undefined || ['all', 'read', 'unread'].includes(query.status));
      requireThat(query.sort === undefined || ['created-asc', 'created-desc'].includes(query.sort));
      requireThat(query.q === undefined || typeof query.q === 'string' && query.q.length <= 254);
      const {
          page,
          pageSize,
          offset
        } = paging(query),
        params = [userId],
        where = ['user_id=?'];
      if (query.unread === true || query.unread === 'true' || query.status === 'unread') where.push('is_read=0');else if (query.status === 'read') where.push('is_read=1');
      if (query.q) {
        where.push('(title LIKE ? OR message LIKE ?)');
        params.push('%' + query.q + '%', '%' + query.q + '%');
      }
      const filter = where.join(' AND '),
        direction = query.sort === 'created-asc' ? 'ASC' : 'DESC';
      const [[summary]] = await c.execute(`SELECT COUNT(*) total,COALESCE(SUM(is_read=0),0) unread FROM notification WHERE ${filter}`, params);
      const [items] = await c.execute(`SELECT CAST(notification_id AS CHAR) id,title,message,notification_type type,is_read isRead,created_at createdAt,read_at readAt FROM notification WHERE ${filter} ORDER BY created_at ${direction},notification_id ${direction} LIMIT ? OFFSET ?`, [...params, String(pageSize), String(offset)]);
      return ok({
        items: items.map(r => ({
          ...r,
          isRead: Boolean(Number(r.isRead))
        })),
        total: Number(summary.total),
        unreadCount: Number(summary.unread),
        page,
        pageSize
      });
    }),
    markRead: (userId, notificationId) => read(db, async c => {
      requireThat(id(userId) && id(notificationId));
      const r = await rows(c, 'UPDATE notification SET is_read=1,read_at=COALESCE(read_at,UTC_TIMESTAMP(3)) WHERE notification_id=? AND user_id=?', [notificationId, userId]);
      return r.affectedRows ? ok({
        notificationId,
        isRead: true
      }) : {
        success: false,
        code: 'NOT_FOUND'
      };
    })
  };
}
