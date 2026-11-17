export function requestLogMiddleware(request, response, next) {
  const startedAt = process.hrtime.bigint();

  response.once('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    console.info(JSON.stringify({
      event: 'http_request_completed',
      requestId: request.requestId ?? null,
      method: request.method,
      statusCode: response.statusCode,
      durationMs: Math.round(durationMs)
    }));
  });

  next();
}
