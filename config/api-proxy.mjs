// Keep API failures JSON-only; Vite's default unreachable-target response is empty.
export function createApiProxy(target = 'http://127.0.0.1:3000') {
  return {
    target,
    changeOrigin: false,
    configure(proxy) {
      proxy.on('error', (_error, _request, response) => {
        if (!response || response.headersSent || response.writableEnded || !response.writeHead) return;
        response.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify({
          success: false,
          code: 'API_UNAVAILABLE',
          message: 'The authentication/API service is unavailable. Start the backend with npm run server, then retry.'
        }));
      });
    }
  };
}
