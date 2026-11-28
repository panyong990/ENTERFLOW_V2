import { rows } from '../phase2/core.js';

export async function loadReadyForDispatch(
  connection,
  queryRows = rows
) {
  const records = await queryRows(connection, `
    WITH eligible AS (
      SELECT
        j.jo_id,
        j.jo_no,
        j.po_id,
        j.status,
        j.completed_at,
        COUNT(*) OVER() AS total
      FROM job_order j
      WHERE j.status = 'ready_for_dispatch'
        AND j.archived_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM delivery d
          JOIN waybill w
            ON w.delivery_id = d.delivery_id
          WHERE d.jo_id = j.jo_id
            AND w.printed_at IS NOT NULL
        )
    ),
    preview AS (
      SELECT *
      FROM eligible
      ORDER BY completed_at DESC, jo_id DESC
      LIMIT 6
    )
    SELECT
      CAST(p.jo_id AS CHAR) AS id,
      p.jo_no AS joNumber,
      p.status,
      CAST(p.total AS CHAR) AS total,
      p.completed_at AS completedAt,
      MAX(c.company_name) AS client,
      (
        SELECT first_item.item_name
        FROM job_order_item first_item
        WHERE first_item.jo_id = p.jo_id
        ORDER BY first_item.line_no, first_item.jo_item_id
        LIMIT 1
      ) AS product,
      CAST(SUM(ji.quantity) AS CHAR) AS totalQuantity
    FROM preview p
    LEFT JOIN job_order_item ji
      ON ji.jo_id = p.jo_id
    LEFT JOIN purchase_order po
      ON po.po_id = p.po_id
    LEFT JOIN quotation q
      ON q.quotation_id = po.quotation_id
    LEFT JOIN inquiry i
      ON i.inquiry_id = q.inquiry_id
    LEFT JOIN client c
      ON c.client_id = i.client_id
    GROUP BY
      p.jo_id,
      p.jo_no,
      p.status,
      p.completed_at,
      p.total
    ORDER BY p.completed_at DESC, p.jo_id DESC
  `);

  return {
    total: records.length
      ? String(records[0].total)
      : '0',

    items: records.map(({ total, ...item }) => item)
  };
}

const EVENT_TITLES = {
  generated: 'Waybill generated',
  printed: 'Waybill printed',
  'printed-record': 'Waybill printed',
  verified: 'Waybill QR verified'
};

export async function loadWaybillActivity(
  connection,
  queryRows = rows
) {
  const records = await queryRows(connection, `
    SELECT
      CAST(e.eventId AS CHAR) AS id,
      e.kind,
      e.eventDate AS date,
      e.waybillNumber,
      e.joNumber,
      CAST(e.actorId AS CHAR) AS actorId
    FROM (
      SELECT
        w.waybill_id AS eventId,
        'generated' AS kind,
        w.generated_at AS eventDate,
        w.waybill_no AS waybillNumber,
        j.jo_no AS joNumber,
        w.generated_by_user_id AS actorId
      FROM waybill w
      JOIN delivery d
        ON d.delivery_id = w.delivery_id
      JOIN job_order j
        ON j.jo_id = d.jo_id

      UNION ALL

      SELECT
        a.audit_event_id AS eventId,
        CASE
          WHEN a.action = 'waybill.printed'
            THEN 'printed'
          ELSE 'verified'
        END AS kind,
        a.occurred_at AS eventDate,
        w.waybill_no AS waybillNumber,
        j.jo_no AS joNumber,
        a.actor_user_id AS actorId
      FROM audit_event a
      JOIN waybill w
        ON w.waybill_id = a.subject_id
      JOIN delivery d
        ON d.delivery_id = w.delivery_id
      JOIN job_order j
        ON j.jo_id = d.jo_id
      WHERE a.subject_type = 'waybill'
        AND a.action IN (
          'waybill.printed',
          'waybill.scan_verified'
        )

      UNION ALL

      SELECT
        w.waybill_id AS eventId,
        'printed-record' AS kind,
        w.printed_at AS eventDate,
        w.waybill_no AS waybillNumber,
        j.jo_no AS joNumber,
        NULL AS actorId
      FROM waybill w
      JOIN delivery d
        ON d.delivery_id = w.delivery_id
      JOIN job_order j
        ON j.jo_id = d.jo_id
      WHERE w.printed_at IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM audit_event a
          WHERE a.subject_type = 'waybill'
            AND a.subject_id = w.waybill_id
            AND a.action = 'waybill.printed'
        )
    ) e
    ORDER BY
      e.eventDate DESC,
      e.eventId DESC,
      e.kind ASC
    LIMIT 6
  `);

  return records.map(record => ({
    id: `waybill-${record.kind}-${record.id}`,
    date: record.date,
    title: EVENT_TITLES[record.kind],
    subject: record.joNumber,
    description: record.waybillNumber,
    actorId: record.actorId
  }));
}

function timestamp(value) {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value !== 'string') return NaN;

  const sqlDate =
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/;

  return Date.parse(
    sqlDate.test(value)
      ? value.replace(' ', 'T') + 'Z'
      : value
  );
}

export function mergeRecentActivity(...groups) {
  return groups
    .flat()
    .map(entry => ({
      entry,
      time: timestamp(entry.date)
    }))
    .filter(({ time }) => Number.isFinite(time))
    .sort((a, b) =>
      b.time - a.time ||
      String(a.entry.id).localeCompare(String(b.entry.id))
    )
    .slice(0, 6)
    .map(({ entry }) => entry);
}

export async function loadJOHandoverActivity(
  connection,
  queryRows = rows
) {
  const records = await queryRows(connection, `
    SELECT
      CAST(j.jo_id AS CHAR) AS id,
      j.jo_no AS joNumber,
      j.completed_at AS date,
      (
        SELECT ji.item_name
        FROM job_order_item ji
        WHERE ji.jo_id = j.jo_id
        ORDER BY ji.line_no, ji.jo_item_id
        LIMIT 1
      ) AS product,
      (
        SELECT CAST(js.marked_by_user_id AS CHAR)
        FROM job_order_stage js
        JOIN production_stage ps
          ON ps.stage_id = js.stage_id
        WHERE js.jo_id = j.jo_id
          AND js.status = 'completed'
          AND js.completed_at IS NOT NULL
          AND js.completed_at <= j.completed_at
        ORDER BY js.completed_at DESC, ps.stage_order DESC
        LIMIT 1
      ) AS actorId
    FROM job_order j
    WHERE j.completed_at IS NOT NULL
      AND j.archived_at IS NULL
      AND j.status <> 'cancelled'
    ORDER BY j.completed_at DESC, j.jo_id DESC
    LIMIT 6
  `);

  return records.map(record => ({
    id: `handover-${record.id}`,
    date: record.date,
    title: 'Job order handed over to Warehouse',
    subject: record.joNumber,
    description: record.product ?? 'Completed job order',
    actorId: record.actorId
  }));
}
