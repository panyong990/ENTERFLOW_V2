import { pool } from './src/config/database.js';

try {
  const [users] = await pool.query('SHOW CREATE TABLE users');

  console.log('\n=== USERS TABLE STRUCTURE ===');
  console.log(users[0]['Create Table']);

  const [tables] = await pool.query(
    "SHOW TABLES LIKE '%user%'"
  );

  console.log('\n=== USER-RELATED TABLES ===');
  console.table(tables);

} catch (error) {
  console.error('Database inspection failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
