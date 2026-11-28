const normalize = value =>
  String(value ?? '').trim().toLocaleLowerCase();

export function buildOrderHistory(orders) {
  return [...new Map(
    orders
      .filter(order => !order.archived)
      .map(order => [String(order.id), order])
  ).values()];
}

export function matchesFinishedGood(item, order, product) {
  if (
    item.clientId == null ||
    order.clientId == null ||
    String(item.clientId) !== String(order.clientId)
  ) {
    return false;
  }

  const pn = normalize(product.oem);

  if (pn) {
    return pn === normalize(item.enterFilPN);
  }

  return normalize(product.filterName ?? product.type)
    === normalize(item.itemName);
}

export function getFinishedGoodOrderActivity(
  item,
  history,
  includeProduct = () => true
) {
  const matchingOrders = [];
  const matchingProductsByOrder = [];

  for (const order of history) {
    const products = order.products.filter(product =>
      matchesFinishedGood(item, order, product) &&
      includeProduct(product)
    );

    if (!products.length) continue;

    matchingOrders.push(order);
    matchingProductsByOrder.push(products);
  }

  return {
    matchingOrders,
    matchingProductsByOrder,
    recurringOrders: matchingOrders.length
  };
}

export function getTopClientsByOrders(items, orders) {
  const history = buildOrderHistory(orders);
  const clients = new Map();

  for (const item of items) {
    const activity = getFinishedGoodOrderActivity(
      item, history
    );

    if (!activity.recurringOrders) continue;

    const key = String(item.clientId);

    const aggregate = clients.get(key) ?? {
      clientId: key,
      client: item.client,
      orderIds: new Set()
    };

    for (const order of activity.matchingOrders) {
      aggregate.orderIds.add(String(order.id));
    }

    clients.set(key, aggregate);
  }

  return [...clients.values()]
    .map(client => ({
      clientId: client.clientId,
      client: client.client,
      totalOrders: client.orderIds.size
    }))
    .sort((a, b) =>
      b.totalOrders - a.totalOrders ||
      a.client.localeCompare(b.client)
    )
    .slice(0, 3);
}

export function rankFinishedGoods(items, orders, filters = {}) {
  const {
    q = '',
    filterType = '',
    month = '',
    year = '',
    sort = 'orders-desc'
  } = filters;

  const history = buildOrderHistory(orders);
  const query = normalize(q);
  const hasFilters = Boolean(filterType || month || year);

  const activity = items.map(item => {
    const result = getFinishedGoodOrderActivity(
      item,
      history,
      product =>
        !filterType ||
        String(product.filterTypeId) === String(filterType)
    );

    const indexes = result.matchingOrders.flatMap(
      (order, index) => {
        const date = String(order.submittedDate ?? '');
        const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);

        return (
          (!month || parts?.[2] === month) &&
          (!year || parts?.[1] === year)
        ) ? [index] : [];
      }
    );

    const products = indexes.flatMap(
      index => result.matchingProductsByOrder[index]
    );

    const filterTypeLabel = products
      .map(product => product.filterTypeLabel ?? product.type ?? '')
      .sort((a, b) => a.localeCompare(b))[0] ?? '';

    const matchesSearch =
      !query ||
      [
        item.itemCode,
        item.enterFilPN,
        item.itemName,
        item.client
      ].some(value => normalize(value).includes(query)) ||
      result.matchingOrders.some(order =>
        normalize(order.code).includes(query)
      );

    return {
      item,
      recurringOrders: indexes.length,
      filterTypeLabel,
      matchesSearch
    };
  }).filter(row =>
    row.matchesSearch &&
    (!hasFilters || row.recurringOrders > 0)
  );

  const topDemandIds = new Set(
    [...activity]
      .filter(row => row.recurringOrders > 0)
      .sort((a, b) =>
        b.recurringOrders - a.recurringOrders ||
        a.item.itemCode.localeCompare(b.item.itemCode)
      )
      .slice(0, 2)
      .map(row => String(row.item.id))
  );

  activity.sort((a, b) => {
    switch (sort) {
      case 'orders-asc':
        return a.recurringOrders - b.recurringOrders;

      case 'company-asc':
        return a.item.client.localeCompare(b.item.client) ||
          b.recurringOrders - a.recurringOrders;

      case 'type-asc':
        return a.filterTypeLabel.localeCompare(b.filterTypeLabel) ||
          b.recurringOrders - a.recurringOrders;

      default:
        return b.recurringOrders - a.recurringOrders;
    }
  });

  return activity.map((row, index) => ({
    item: row.item,
    recurringOrders: row.recurringOrders,
    filterTypeLabel: row.filterTypeLabel,
    rank: index + 1,
    highlighted: topDemandIds.has(String(row.item.id))
  }));
}
