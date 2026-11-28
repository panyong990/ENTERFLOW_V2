import {
  ok, read, rows, id, requireThat, paging, failure
} from '../phase2/core.js';

import { deliveryFrom } from '../phase2/reads.js';

const allowedQueryKeys = new Set([
  'q', 'from', 'to', 'page', 'pageSize'
]);

function utcBoundary(value) {
  requireThat(
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  );

  const parsed = new Date(value);

  requireThat(
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString() === value
  );

  return value.slice(0, -1).replace('T', ' ');
}

export function createWaybillHistoryService({ db }) {
  return {
    async listWaybillHistory(actor, query = {}) {
      if (
        actor?.accountType !== 'employee' ||
        actor?.roleCode !== 'warehouse' ||
        !id(actor.userId)
      ) {
        return { success: false, code: 'FORBIDDEN' };
      }

      let page, pageSize, offset;
      const where = [];
      const params = [];

      try {
        requireThat(
          query && typeof query === 'object' &&
          !Array.isArray(query) &&
          Object.keys(query).every(key => allowedQueryKeys.has(key))
        );

        for (const key of ['page', 'pageSize']) {
          requireThat(
            query[key] === undefined ||
            (
              typeof query[key] === 'string' &&
              /^[1-9]\d*$/.test(query[key])
            )
          );
        }

        ({ page, pageSize, offset } = paging(query));

        requireThat(
          query.q === undefined ||
          (typeof query.q === 'string' && query.q.length <= 200)
        );

        const search = (query.q ?? '').trim();

        if (search) {
          where.push(`(
            LOCATE(LOWER(?), LOWER(w.waybill_no)) > 0 OR
            LOCATE(LOWER(?), LOWER(j.jo_no)) > 0 OR
            LOCATE(LOWER(?), LOWER(c.company_name)) > 0 OR
            EXISTS (
              SELECT 1
              FROM delivery_item sdi
              JOIN job_order_item sji
                ON sji.jo_item_id=sdi.jo_item_id
               AND sji.jo_id=d.jo_id
              WHERE sdi.delivery_id=d.delivery_id
                AND LOCATE(LOWER(?), LOWER(sji.item_name)) > 0
            )
          )`);

          params.push(search, search, search, search);
        }

        if (query.from !== undefined || query.to !== undefined) {
          const from = utcBoundary(query.from);
          const to = utcBoundary(query.to);

          requireThat(from < to);

          where.push('a.occurred_at >= ? AND a.occurred_at < ?');
          params.push(from, to);
        }
      } catch (error) {
        return failure(error);
      }

      return read(db, async connection => {
        const records = await rows(connection, `
          SELECT
            CAST(w.waybill_id AS CHAR) id,
            CAST(d.delivery_id AS CHAR) deliveryId,
            w.waybill_no waybillNo,
            a.occurred_at verifiedAt,
            j.jo_no jo,
            c.company_name client,
            dm.method_name method,
            p.po_no po,
            (
              SELECT CASE WHEN COUNT(*)=1
                THEN MAX(si.invoice_no)
                ELSE NULL END
              FROM sales_invoice si
              WHERE si.po_id=p.po_id
            ) si,
            i.contact_person contact,
            u.full_name processedBy
          FROM ${deliveryFrom}
          JOIN waybill w
            ON w.delivery_id=d.delivery_id
          JOIN audit_event a
            ON a.audit_event_id=(
              SELECT first_scan.audit_event_id
              FROM audit_event first_scan
              WHERE first_scan.subject_type='waybill'
                AND first_scan.subject_id=w.waybill_id
                AND first_scan.action='waybill.scan_verified'
              ORDER BY first_scan.occurred_at ASC,
                       first_scan.audit_event_id ASC
              LIMIT 1
            )
          LEFT JOIN user_account u
            ON u.user_id=a.actor_user_id
          WHERE ${where.length ? where.join(' AND ') : '1=1'}
          ORDER BY a.occurred_at DESC, a.audit_event_id DESC
          LIMIT ? OFFSET ?
        `, [...params, String(pageSize + 1), String(offset)]);

        const hasMore = records.length > pageSize;
        const items = records.slice(0, pageSize).map(row => ({
          ...row,
          waybillItems: []
        }));

        if (items.length) {
          const deliveryIds = items.map(row => row.deliveryId);

          const allocations = await rows(connection, `
            SELECT
              CAST(di.delivery_id AS CHAR) deliveryId,
              ji.item_name name,
              CAST(di.quantity AS CHAR) quantity
            FROM delivery_item di
            JOIN delivery d ON d.delivery_id=di.delivery_id
            JOIN job_order_item ji
              ON ji.jo_item_id=di.jo_item_id
             AND ji.jo_id=d.jo_id
            WHERE di.delivery_id IN (
              ${deliveryIds.map(() => '?').join(',')}
            )
            ORDER BY di.delivery_id, ji.line_no,
                     di.delivery_item_id
          `, deliveryIds);

          const byDelivery = new Map(
            items.map(row => [row.deliveryId, row])
          );

          for (const allocation of allocations) {
            byDelivery.get(allocation.deliveryId)?.waybillItems.push({
              name: allocation.name,
              quantity: allocation.quantity
            });
          }
        }

        return ok({
          items,
          page,
          pageSize,
          hasMore
        });
      });
    }
  };
}
