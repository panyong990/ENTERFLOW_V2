import { api } from './client';

export type HistoryDateFilter =
  'today' | '7days' | '30days' | 'all';

export interface WarehouseWaybillHistoryRecord {
  id: string;
  deliveryId: string;
  waybillNo: string;
  verifiedAt: string;
  jo: string;
  client: string;
  method: string | null;
  po: string | null;
  si: string | null;
  contact: string | null;
  processedBy: string | null;
  waybillItems: {
    name: string;
    quantity: string;
  }[];
}

interface HistoryResponse {
  items: WarehouseWaybillHistoryRecord[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export function historyDateRange(
  filter: HistoryDateFilter,
  now = new Date()
) {
  if (filter === 'all') return null;

  const from = new Date(now);
  from.setHours(0, 0, 0, 0);

  const to = new Date(from);
  to.setDate(to.getDate() + 1);

  if (filter === '7days') {
    from.setDate(from.getDate() - 6);
  }

  if (filter === '30days') {
    from.setDate(from.getDate() - 29);
  }

  return {
    from: from.toISOString(),
    to: to.toISOString()
  };
}

export async function listWarehouseWaybillHistory(
  search: string,
  filter: HistoryDateFilter,
  page: number,
  signal?: AbortSignal
) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: '25'
  });

  if (search.trim()) {
    params.set('q', search.trim());
  }

  const range = historyDateRange(filter);

  if (range) {
    params.set('from', range.from);
    params.set('to', range.to);
  }

  const result = await api<HistoryResponse>(
    `/api/warehouse/waybill-history?${params.toString()}`,
    { signal }
  );

  if (
    !result ||
    !Array.isArray(result.items) ||
    result.page !== page ||
    result.pageSize !== 25 ||
    typeof result.hasMore !== 'boolean' ||
    result.items.length > 25
  ) {
    throw new Error('Invalid History response.');
  }

  return result;
}

function totalQuantity(values: string[]) {
  if (!values.length) return '\u2014';

  const parts = values.map(value => {
    if (!/^\d+(?:\.\d+)?$/.test(value)) {
      throw new Error('Invalid shipment quantity.');
    }

    return value.split('.');
  });

  const scale = Math.max(
    0, ...parts.map(part => part[1]?.length ?? 0)
  );

  const sum = parts.reduce((total, [whole, fraction = '']) =>
    total + BigInt(whole + fraction.padEnd(scale, '0')), 0n
  );

  if (!scale) return sum.toString();

  const digits = sum.toString().padStart(scale + 1, '0');

  const fraction = digits.slice(-scale).replace(/0+$/, '');

  return digits.slice(0, -scale) +
    (fraction ? `.${fraction}` : '');
}

export function toHistoryRow(row: WarehouseWaybillHistoryRecord) {
  const date = new Date(row.verifiedAt);

  if (
    !Number.isFinite(date.getTime()) ||
    !Array.isArray(row.waybillItems)
  ) {
    throw new Error('Invalid History record.');
  }

  return {
    id: row.id,
    deliveryId: row.deliveryId,
    date: date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }),
    waybillNo: row.waybillNo,
    jo: row.jo,
    client: row.client,
    item: row.waybillItems.map(item => item.name).join(', ')
      || '\u2014',
    qty: totalQuantity(
      row.waybillItems.map(item => item.quantity)
    ),
    method: row.method ?? '\u2014',
    matchedJob: {
      po: row.po ?? '\u2014',
      si: row.si ?? '\u2014',
      contact: row.contact ?? '\u2014',
      sketch: undefined as string | undefined
    }
  };
}
