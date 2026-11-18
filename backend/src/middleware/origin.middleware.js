export function createOriginMiddleware({
  appOrigin = process.env.APP_ORIGIN,
  allowMultipart = false
} = {}) {
  return function requireSameOrigin(request, response, next) {
    if (!appOrigin) {
      return response.status(503).json({
        success: false,
        message: 'Application security configuration is unavailable.'
      });
    }

    const origin = request.get('Origin');

    if (!origin || origin !== appOrigin) {
      return response.status(403).json({
        success: false,
        message: 'Request origin is not allowed.'
      });
    }

    if (!request.is('application/json') && !(allowMultipart && request.is('multipart/form-data'))) {
      return response.status(415).json({
        success: false,
        message: allowMultipart ? 'Content-Type must be JSON or multipart form data.' : 'Content-Type must be application/json.'
      });
    }

    const fetchSite = request.get('Sec-Fetch-Site');

    if (fetchSite && fetchSite !== 'same-origin') {
      return response.status(403).json({
        success: false,
        message: 'Cross-origin requests are not allowed.'
      });
    }

    next();
  };
}

export default createOriginMiddleware();
