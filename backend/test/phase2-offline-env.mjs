// Unit/HTTP-double tests only. Never decrypt a credential or select .env.dev.
Object.assign(process.env, {
  PHASE2_RUNTIME: '1',
  NODE_ENV: 'development',
  DB_HOST: '127.0.0.1',
  DB_PORT: '62286',
  DB_NAME: 'enterflow_phase2_db',
  DB_USER: 'enterflow_phase2_app',
  DB_PASSWORD: 'offline-invalid-credential-never-used',
  DB_POOL_MAX: '2',
  DB_TIMEZONE: 'Z',
  DB_SSL_CA_PATH: 'backend/certs/local/phase2/ca.pem',
  DB_SSL_SERVER_NAME: 'localhost',
  SESSION_IDLE_TIMEOUT_MINUTES: '30',
  SESSION_ABSOLUTE_TIMEOUT_HOURS: '8',
  APP_ORIGIN: 'http://127.0.0.1:3107',
  HOST: '127.0.0.1',
  PORT: '3107'
});
