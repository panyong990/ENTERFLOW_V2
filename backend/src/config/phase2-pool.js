// Enforce target identity on every checkout before any business SQL is issued.
export function guardPhase2Pool(rawPool, runtime) {
  if (!runtime.phase2) return rawPool;
  const guarded = {
    async getConnection() {
      console.log('PHASE2_CHECK=CONNECTING');
      let c;
      try {
        c = await rawPool.getConnection();
      } catch (error) {
        const code = typeof error?.code === 'string' ? error.code : 'UNKNOWN';
        const category = ['ECONNREFUSED','ETIMEDOUT','ENOTFOUND','EHOSTUNREACH','ER_ACCESS_DENIED_ERROR','HANDSHAKE_SSL_ERROR','ERR_TLS_CERT_ALTNAME_INVALID','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE'].includes(code) ? code : 'OTHER';
        console.error('PHASE2_CONNECTION_ERROR_CATEGORY=' + category);
        throw error;
      }
      console.log('PHASE2_CHECK=CONNECTED');
      try {
        const stream = c.connection?.stream;
        if (!stream?.encrypted || stream.authorized !== true) throw new Error('Phase 2 TLS validation failed');
        const [[row]] = await c.query('SELECT DATABASE() AS name,VERSION() AS version,@@server_uuid AS serverUuid,CURRENT_USER() AS account,@@SESSION.sql_mode AS sqlMode');
        const databaseUser = runtime.phase2.databaseUser ?? 'enterflow_phase2_app';
        const accountValid = runtime.phase2.shared
          ? row.account === `${databaseUser}@172.17.0.1`
          : row.account.startsWith('enterflow_phase2_app@');
        if (row.name !== 'enterflow_phase2_db' || row.version !== '8.4.13' || row.serverUuid !== runtime.phase2.serverUuid || !accountValid || !String(row.sqlMode).split(',').includes('STRICT_TRANS_TABLES')) throw new Error('Phase 2 connection identity failed');
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
