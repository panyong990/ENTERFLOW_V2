// Include archived history and filter before pagination, independently of pipeline search.
export function cancellationQuery(filters, cancellationStatus, page) {
  return { ...filters, q: '', stage: 'all', status: 'all', cancellationStatus, page };
}

export function uncertainWrite(error) {
  return error?.status === 0 || error?.status === 503 ||
    ['NETWORK_ERROR', 'INVALID_RESPONSE', 'WRITE_OUTCOME_UNKNOWN'].includes(error?.code);
}
