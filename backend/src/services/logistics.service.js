import { createShipmentReadService } from './shipment-read.service.js';

export function createLogisticsService({ db }) {
  return createShipmentReadService({ db, roleCode: 'logistics', handoffOnly: true });
}
