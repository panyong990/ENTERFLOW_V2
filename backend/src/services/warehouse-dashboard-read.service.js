import { ok, failure, rows } from '../phase2/core.js';
import { readWarehouseSnapshot } from './warehouse-read-snapshot.js';
import { loadFinishedGoodsActivity } from './finished-goods-read.service.js';
import { getTopClientsByOrders } from './finished-goods-activity.js';
import { loadJOHandoverActivity } from './warehouse-dashboard-dispatch.js';
import { loadReadyForDispatch, loadWaybillActivity, mergeRecentActivity } from './warehouse-dashboard-dispatch.js';

import {
  summarizeWarehouseStock
} from './warehouse-dashboard-stock.js';

export { readWarehouseSnapshot };

export async function loadWarehouseStock(
  connection,
  queryRows = rows
) {
  const rawMaterials = await queryRows(connection, `
    SELECT
      CAST(m.material_id AS CHAR) AS id,
      m.material_name AS name,
      m.qty_in_stock AS qtyInStock,
      m.quantity_status AS quantityStatus,
      m.reorder_threshold AS threshold,
      m.threshold_status AS thresholdStatus,
      u.abbreviation AS unit
    FROM raw_material m
    JOIN unit_of_measure u
      ON u.uom_id = m.uom_id
    WHERE m.is_active = 1
    ORDER BY m.material_name, m.material_id
  `);

  const finishedGoods = await queryRows(connection, `
    SELECT
      CAST(finished_good_id AS CHAR) AS id,
      qty_in_stock AS qtyInStock,
      quantity_status AS quantityStatus
    FROM finished_good
    WHERE is_active = 1
    ORDER BY finished_good_id
  `);

  return summarizeWarehouseStock(
    rawMaterials,
    finishedGoods
  );
}

export async function loadInventoryActivity(
  connection,
  queryRows = rows
) {
  const records = await queryRows(connection, `
    SELECT
      CAST(s.movement_id AS CHAR) AS id,
      s.item_type AS itemType,
      CASE
        WHEN s.item_type = 'raw_material'
          THEN m.material_name
        ELSE f.item_name
      END AS subject,
      s.qty_before AS oldQty,
      s.qty_after AS newQty,
      s.quantity_status_before AS quantityStatusBefore,
      s.movement_reason AS reason,
      CASE
        WHEN s.item_type = 'finished_good'
          THEN 'pcs'
        ELSE u.abbreviation
      END AS unit,
      CAST(s.performed_by_user_id AS CHAR) AS actorId,
      s.created_at AS date
    FROM stock_movement s
    LEFT JOIN raw_material m
      ON m.material_id = s.raw_material_id
    LEFT JOIN finished_good f
      ON f.finished_good_id = s.finished_good_id
    LEFT JOIN unit_of_measure u
      ON u.uom_id = s.uom_id
    WHERE
      (s.item_type = 'raw_material' AND m.is_active = 1)
      OR
      (s.item_type = 'finished_good' AND f.is_active = 1)
    ORDER BY s.created_at DESC, s.movement_id DESC
    LIMIT 6
  `);

  return records.map(record => ({
    id: `movement-${record.id}`,
    date: record.date,
    title: record.itemType === 'raw_material'
      ? 'Raw material stock updated'
      : 'Finished goods stock updated',
    subject: record.subject,
    oldQty: record.oldQty == null
      ? null
      : String(record.oldQty),
    newQty: String(record.newQty),
    quantityStatusBefore: record.quantityStatusBefore,
    reason: record.reason,
    unit: record.unit,
    actorId: record.actorId
  }));
}

export function createWarehouseDashboardReadService({
  db,
  queryRows = rows
}) {
  return {
    async getDashboard(actor) {
      if (
        actor?.accountType !== 'employee' ||
        actor.roleCode !== 'warehouse'
      ) {
        return {
          success: false,
          code: 'FORBIDDEN'
        };
      }

      try {
        return await readWarehouseSnapshot(
          db,
          async connection => {
            const stock = await loadWarehouseStock(
              connection,
              queryRows
            );

            const inventoryActivity =
              await loadInventoryActivity(
                connection,
                queryRows
              );

            const readyForDispatch = await loadReadyForDispatch(connection, queryRows);
            const waybillActivity = await loadWaybillActivity(connection, queryRows);
            const handoverActivity = await loadJOHandoverActivity(connection, queryRows);
            const finishedGoodsActivity = await loadFinishedGoodsActivity(connection, queryRows);
            const topClientsByOrders = getTopClientsByOrders(
              finishedGoodsActivity.items,
              finishedGoodsActivity.orders
            );
            return ok({
              ...stock,
              readyForDispatch,
              topClientsByOrders,
              recentActivity: mergeRecentActivity(
                inventoryActivity,
                waybillActivity,
                handoverActivity
              ),
              recentActivityComplete: false,
              inventoryActivity
            });
          }
        );
      } catch (error) {
        return failure(error);
      }
    }
  };
}
