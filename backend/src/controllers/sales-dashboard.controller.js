export function createSalesDashboardController({ service }) {
  return async (request, response) => {
    try {
      const result = await service.dashboard();
      if (result?.success === true) return response.status(200).json({ success: true, data: result.data });
      return response.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'Sales dashboard service is temporarily unavailable.' });
    } catch {
      return response.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'Sales dashboard service is temporarily unavailable.' });
    }
  };
}
