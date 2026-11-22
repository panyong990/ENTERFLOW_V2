// Enforce target identity on every checkout before any business SQL is issued.
export function guardPhase2Pool(rawPool, runtime) {
  if (!runtime.phase2) return rawPool;
  const guarded = {
    async getConnection() {
      const c = await rawPool.getConnection();
      try {
        const stream = c.connection?.stream;
        if (!stream?.encrypted || stream.authorized !== true) throw new Error('Phase 2 TLS validation failed');
        const [[row]] = await c.query('SELECT DATABASE() AS name,VERSION() AS version,@@server_uuid AS serverUuid,CURRENT_USER() AS account,@@SESSION.sql_mode AS sqlMode');
        if (row.name !== 'enterflow_phase2_db' || row.version !== '8.4.13' || row.serverUuid !== runtime.phase2.serverUuid || !row.account.startsWith('enterflow_phase2_app@') || !String(row.sqlMode).split(',').includes('STRICT_TRANS_TABLES')) throw new Error('Phase 2 connection identity failed');
        await c.query("SET SESSION time_zone='+00:00'");
        return c;
      } catch {
        c.destroy();
        throw new Error('Phase 2 database identity verification failed');
      }
    },
    async execute(sql, params) {
      const c = await guarded.getConnection();
      try {
        return await c.execute(sql, params);
      } finally {
        c.release();
      }
    },
    async query(sql, params) {
      const c = await guarded.getConnection();
      try {
        return await c.query(sql, params);
      } finally {
        c.release();
      }
    },
    end: () => rawPool.end()
  };
  return guarded;
}
