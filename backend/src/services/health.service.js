
import { testDatabaseConnection } from '../config/database.js';

export async function getHealthStatus() {
  const database = await testDatabaseConnection();

  return {
    api: 'online',
    database: 'connected',
    databaseName: database.databaseName,
    serverVersion: database.serverVersion
  };
}
