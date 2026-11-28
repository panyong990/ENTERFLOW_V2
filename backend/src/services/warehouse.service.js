import { createShipmentReadService } from './shipment-read.service.js';
import { createWaybillHistoryService } from './waybill-history.service.js';
import { createFinishedGoodsReadService } from './finished-goods-read.service.js';
import { createWarehouseDashboardReadService } from './warehouse-dashboard-read.service.js';

export function createWarehouseService({ db }) {
  return { ...createShipmentReadService({ db, roleCode: 'warehouse' }), ...createWaybillHistoryService({ db }),
    ...createFinishedGoodsReadService({ db }),
    ...createWarehouseDashboardReadService({ db }) };
}
