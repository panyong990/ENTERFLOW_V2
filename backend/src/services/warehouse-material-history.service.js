import { ok, rows, failure } from '../phase2/core.js';
import { readWarehouseSnapshot } from './warehouse-read-snapshot.js';

const validId = value =>
  typeof value === 'string' &&
  /^[1-9]\d{0,19}$/.test(value) &&
  BigInt(value) <= 18446744073709551615n;

export function createWarehouseMaterialHistoryService({ db }) {
  return {
    async list(actor, materialId, query = {}) {
      if (
        actor?.accountType !== 'employee' ||
        actor.roleCode !== 'warehouse'
      ) {
        return { success: false, code: 'FORBIDDEN' };
      }

      if (
        !validId(materialId) ||
        !query ||
        typeof query !== 'object' ||
        Array.isArray(query) ||
        Object.keys(query).some(key => key !== 'page')
      ) {
        return { success: false, code: 'VALIDATION_ERROR' };
      }

      const page = query.page ?? '1';

      if (
        typeof page !== 'string' ||
        !/^[1-9]\d{0,4}$/.test(page) ||
        Number(page) > 10000
      ) {
        return { success: false, code: 'VALIDATION_ERROR' };
      }

      const pageSize = 50;
      const offset = (Number(page) - 1) * pageSize;

      try {
        return await readWarehouseSnapshot(db, async connection => {
          const materials = await rows(connection, `
            SELECT CAST(material_id AS CHAR) AS id,
                   material_name AS name
            FROM raw_material
            WHERE material_id = ?
              AND is_active = 1
          `, [materialId]);

          if (!materials.length) {
            return { success: false, code: 'NOT_FOUND' };
          }

          const movements = await rows(connection, `
            SELECT
              CAST(sm.movement_id AS CHAR) AS id,
              CONCAT(
                DATE_FORMAT(sm.created_at, '%Y-%m-%dT%H:%i:%s.'),
                LEFT(DATE_FORMAT(sm.created_at, '%f'), 3),
                'Z'
              ) AS date,
              CAST(sm.performed_by_user_id AS CHAR) AS actorId,
              u.full_name AS employee,
              sm.quantity_status_before AS quantityStatusBefore,
              CAST(sm.qty_before AS CHAR) AS oldQty,
              CAST(sm.qty_after AS CHAR) AS newQty,
              CAST(sm.qty_change AS CHAR) AS \`change\`,
              um.abbreviation AS unit,
              sm.movement_reason AS reason,
              sm.reference_no AS reference,
              j.jo_no AS jobOrder
            FROM stock_movement sm
            JOIN user_account u
              ON u.user_id = sm.performed_by_user_id
            JOIN unit_of_measure um
              ON um.uom_id = sm.uom_id
            LEFT JOIN job_order j
              ON j.jo_id = sm.jo_id
            WHERE sm.item_type = 'raw_material'
              AND sm.raw_material_id = ?
            ORDER BY sm.created_at DESC, sm.movement_id DESC
            LIMIT ? OFFSET ?
          `, [materialId, pageSize + 1, offset]);

          return ok({
            material: materials[0],
            items: movements.slice(0, pageSize),
            page: Number(page),
            pageSize,
            hasMore: movements.length > pageSize
          });
        });
      } catch (error) {
        return failure(error);
      }
    }
  };
}