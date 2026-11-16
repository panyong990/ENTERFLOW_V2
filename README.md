
  # Enter-Flow

  This is a code bundle for Enter-Flow. The original project is available at https://www.figma.com/design/p5yrAuAAgtJmPCT7VKM31e/Enter-Flow.

  ## Running the code

  Run `npm i` to install the dependencies.

  Real login requires both servers. With the existing authorized Docker/MySQL
  development database running and the private `database/.env.dev` and trusted
  CA configured, run `npm run server` in one terminal. Wait for the API startup
  message, then run `npm run dev` in another terminal and open
  `http://localhost:5173` (the configured `APP_ORIGIN`). Vite proxies `/api` to
  `http://127.0.0.1:3000`; `npm run dev` alone starts only the frontend.

  Backend startup checks database connectivity with strict TLS and does not run
  migrations or seed accounts. If startup fails, resolve the reported runtime,
  database or certificate prerequisite before attempting login. Keep the exact
  configured origin: switching to `127.0.0.1` or another port will be rejected by
  the existing origin protection. Vite now refuses a busy port instead of
  silently choosing a different origin.

  ## Operations Manager Sales & Orders

  The Operations Manager's Sales & Orders screen is a read-only monitoring interface over the application's shared order data. Its UI hides operational controls, but this is a frontend-only restriction and does not provide secure server-side authorization. Do not treat client-side role checks as a security boundary for protecting data or actions.

