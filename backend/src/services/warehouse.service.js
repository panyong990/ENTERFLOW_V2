import { createShipmentReadService } from './shipment-read.service.js';

export function createWarehouseService({ db }) {
  return createShipmentReadService({ db, roleCode: 'warehouse' });
}
