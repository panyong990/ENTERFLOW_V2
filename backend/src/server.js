
import app from './app.js';
import { pool } from './config/database.js';

const PORT = Number(process.env.PORT || 3000);

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`Enter-Flow API running at http://127.0.0.1:${PORT}`);
});

async function shutdown() {
  console.log('\nShutting down Enter-Flow API...');

  server.close(async () => {
    try {
      await pool.end();
      console.log('Server and database connections closed.');
      process.exit(0);
    } catch (error) {
      console.error('Shutdown error:', error.message);
      process.exit(1);
    }
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
