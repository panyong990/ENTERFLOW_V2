import type { FinishedGood } from "./materials";
import type { Inquiry, ProductLine } from "./orders";

export function buildOrderHistory(inquiries: Inquiry[], completedJOs: Inquiry[]): Inquiry[] {
  return Array.from(new Map(
    [...inquiries, ...completedJOs]
      .filter((order) => !order.archived)
      .map((order) => [order.id, order])
  ).values());
}

function normalizedText(value: string | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

function matchesFinishedGood(item: FinishedGood, product: ProductLine): boolean {
  const itemPN = normalizedText(item.enterFilPN);
  const productPN = normalizedText(product.oem);
  if (productPN) return productPN === itemPN;
  return normalizedText(product.filterName ?? product.type) === normalizedText(item.itemName);
}

function orderTimestamp(submittedDate: string): number | null {
  const isoDate = submittedDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoDate) {
    const [, year, month, day] = isoDate;
    const timestamp = new Date(Number(year), Number(month) - 1, Number(day)).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  const timestamp = Date.parse(submittedDate);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export interface FinishedGoodOrderActivity {
  matchingOrders: Inquiry[];
  matchingProductsByOrder: ProductLine[][];
  recurringOrders: number;
  averageQuantity: number | null;
  lastOrderDate: string | null;
}

export function getFinishedGoodOrderActivity(
  item: FinishedGood,
  orderHistory: Inquiry[],
  includeProduct: (product: ProductLine) => boolean = () => true,
): FinishedGoodOrderActivity {
  const matchingOrders: Inquiry[] = [];
  const matchingProductsByOrder: ProductLine[][] = [];
  const orderQuantities: number[] = [];
  let latestOrder: Inquiry | null = null;
  let latestTimestamp = Number.NEGATIVE_INFINITY;

  for (const order of orderHistory) {
    if (normalizedText(order.clientName) !== normalizedText(item.client)) continue;

    const products = order.products.filter(
      (product) => matchesFinishedGood(item, product) && includeProduct(product)
    );
    if (products.length === 0) continue;

    matchingOrders.push(order);
    matchingProductsByOrder.push(products);
    orderQuantities.push(products.reduce((total, product) => total + product.qty, 0));

    const timestamp = orderTimestamp(order.submittedDate);
    if (timestamp !== null && timestamp > latestTimestamp) {
      latestOrder = order;
      latestTimestamp = timestamp;
    }
  }

  return {
    matchingOrders,
    matchingProductsByOrder,
    recurringOrders: matchingOrders.length,
    averageQuantity: orderQuantities.length
      ? orderQuantities.reduce((total, quantity) => total + quantity, 0) / orderQuantities.length
      : null,
    lastOrderDate: latestOrder?.submittedDate ?? null,
  };
}
