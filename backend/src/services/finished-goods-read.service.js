import { ok, failure, rows } from '../phase2/core.js';
import { readWarehouseSnapshot } from './warehouse-read-snapshot.js';
import { resolveFinishedGoodsOEM } from './finished-goods-oem.js';

import {
  buildOrderHistory,
  rankFinishedGoods
} from './finished-goods-activity.js';

const FILTER_KEYS = new Set([
  'q', 'filterType', 'month', 'year', 'sort'
]);

const SORT_OPTIONS = new Set([
  'orders-desc',
  'orders-asc',
  'company-asc',
  'type-asc'
]);

export function validateFinishedGoodsFilters(query = {}) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return null;
  }

  if (Object.keys(query).some(key => !FILTER_KEYS.has(key))) {
    return null;
  }

  const {
    q = '',
    filterType = '',
    month = '',
    year = '',
    sort = 'orders-desc'
  } = query;

  if (
    [q, filterType, month, year, sort]
      .some(value => typeof value !== 'string')
  ) return null;

  if (q.trim().length > 200) return null;

  if (filterType && (
    !/^[1-9]\d{0,19}$/.test(filterType) ||
    BigInt(filterType) > 18446744073709551615n
  )) return null;

  if (month && !/^(0[1-9]|1[0-2])$/.test(month)) {
    return null;
  }

  if (year && !/^[1-9]\d{3}$/.test(year)) {
    return null;
  }

  if (!SORT_OPTIONS.has(sort)) return null;

  return {
    q: q.trim(),
    filterType,
    month,
    year,
    sort
  };
}

export function assembleOrderHistory(records) {
  const orders = new Map();
  const seenLines = new Map();

  for (const row of records) {
    const orderId = String(row.orderId);

    if (!orders.has(orderId)) {
      orders.set(orderId, {
        id: orderId,
        code: row.orderCode,
        clientId: String(row.clientId),
        submittedDate: row.submittedDate,
        archived: row.status === 'archived',
        products: []
      });

      seenLines.set(orderId, new Set());
    }

    if (row.lineId == null) continue;

    const lineId = String(row.lineId);
    const seen = seenLines.get(orderId);

    if (seen.has(lineId)) continue;

    seen.add(lineId);

    orders.get(orderId).products.push({
      id: lineId,
      oem: resolveFinishedGoodsOEM(row.oem, row.specifications),
      filterName: row.filterName,
      filterTypeId: String(row.filterTypeId),
      filterTypeLabel: row.filterTypeLabel,
      quantity: row.quantity
    });
  }

  return buildOrderHistory([...orders.values()]);
}

export async function loadFinishedGoodsActivity(
  connection,
  queryRows = rows
) {
  const items = await queryRows(connection, `
    SELECT
      CAST(f.finished_good_id AS CHAR) AS id,
      f.item_code AS itemCode,
      f.enterfil_pn AS enterFilPN,
      f.item_name AS itemName,
      CAST(f.client_id AS CHAR) AS clientId,
      c.company_name AS client,
      CAST(f.filter_type_id AS CHAR) AS filterTypeId,
      ft.filter_type_name AS filterTypeLabel,
      f.qty_in_stock AS qtyInStock,
      f.quantity_status AS quantityStatus,
      f.buffer_min AS bufferMin,
      f.threshold_status AS thresholdStatus,
      f.demand_level AS demand
    FROM finished_good f
    JOIN client c ON c.client_id = f.client_id
    JOIN filter_type ft
      ON ft.filter_type_id = f.filter_type_id
    WHERE f.is_active = 1
    ORDER BY f.item_code, f.finished_good_id
  `);

  const records = await queryRows(connection, `
    SELECT
      CAST(i.inquiry_id AS CHAR) AS orderId,
      i.inquiry_no AS orderCode,
      CAST(i.client_id AS CHAR) AS clientId,
      i.status,
      DATE_FORMAT(i.created_at, '%Y-%m-%d') AS submittedDate,
      CAST(ii.inquiry_item_id AS CHAR) AS lineId,
      ii.oem_reference AS oem,
      ii.template_specifications AS specifications,
      ii.filter_name AS filterName,
      CAST(ii.filter_type_id AS CHAR) AS filterTypeId,
      ft.filter_type_name AS filterTypeLabel,
      ii.quantity
    FROM inquiry i
    LEFT JOIN inquiry_item ii
      ON ii.inquiry_id = i.inquiry_id
    LEFT JOIN filter_type ft
      ON ft.filter_type_id = ii.filter_type_id
    WHERE i.status <> 'archived'
    ORDER BY i.inquiry_id, ii.line_no
  `);

  const filterTypes = await queryRows(connection, `
    SELECT
      CAST(filter_type_id AS CHAR) AS id,
      filter_type_name AS name,
      template_group AS templateGroup,
      is_active AS isActive
    FROM filter_type
    ORDER BY template_group, filter_type_name
  `);

  return {
    items,
    orders: assembleOrderHistory(records),
    filterTypes
  };
}

export function buildFinishedGoodsResponse(data, filters) {
  const history = buildOrderHistory(data.orders);

  const years = [...new Set(
    history.flatMap(order => {
      const match = /^(\d{4})-\d{2}-\d{2}$/.exec(
        order.submittedDate ?? ''
      );

      return match ? [match[1]] : [];
    })
  )].sort((a, b) => b.localeCompare(a));

  const items = rankFinishedGoods(
    data.items,
    history,
    filters
  );

  return {
    items,
    total: items.length,
    filterOptions: {
      years,
      filterTypes: data.filterTypes
    }
  };
}

export function createFinishedGoodsReadService({ db }) {
  return {
    async listFinishedGoods(actor, query = {}) {
      if (
        actor?.accountType !== 'employee' ||
        actor.roleCode !== 'warehouse'
      ) {
        return {
          success: false,
          code: 'FORBIDDEN'
        };
      }

      const filters = validateFinishedGoodsFilters(query);

      if (!filters) {
        return {
          success: false,
          code: 'VALIDATION_ERROR'
        };
      }

      try {
        return await readWarehouseSnapshot(
          db,
          async connection => {
            const data = await loadFinishedGoodsActivity(connection);
            return ok(buildFinishedGoodsResponse(data, filters));
          }
        );
      } catch (error) {
        return failure(error);
      }
    }
  };
}
