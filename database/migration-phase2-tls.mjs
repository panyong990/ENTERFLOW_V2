import { checkServerIdentity } from 'node:tls';

export function phase2CertificateName(env) {
  const name = env.DB_TLS_SERVER_NAME ?? '127.0.0.1';
  if (!/^(?:127\.0\.0\.1|(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?)$/.test(name)) throw new Error('Invalid Phase 2 certificate identity');
  return name;
}

export function verifyPhase2Peer(socket, name) {
  if (!socket?.encrypted || socket.authorized !== true || socket.authorizationError) throw new Error('Phase 2 TLS peer is not authorized');
  const error = checkServerIdentity(name, socket.getPeerCertificate(true));
  if (error) throw error;
}

// Per-connection hook runs inside mysql2's TLS callback, BEFORE sendCredentials.
// Do not use promise.createConnection here: that resolves after authentication.
export async function connectPhase2(config, name, driver) {
  if (config.ssl?.verifyIdentity !== true || config.ssl?.rejectUnauthorized !== true) throw new Error('Phase 2 requires verified TLS before authentication');
  const mysql = driver ?? (await import('mysql2')).default;
  // mysql2 caches TLS sessions by SSL-options object identity. A resumed
  // session can expose an empty getPeerCertificate(), so the mandatory
  // explicit IP/SAN check cannot inspect its certificate. Keep this client's
  // SSL options private to each connection: require a full handshake and
  // independently verify the peer BEFORE credentials on owner and observer.
  const connection = mysql.createConnection({...config,ssl:{...config.ssl}});
  const original = connection.startTLS;
  let verified = false;
  if (typeof original !== 'function') {
    connection.destroy();
    throw new Error('Phase 2 requires verified TLS before authentication');
  }
  connection.startTLS = function (done) {
    const fail = error => {
      // mysql2 overwrites error.code with HANDSHAKE_SSL_ERROR. Preserve only
      // the original non-secret classification for the preflight diagnostic.
      error.phase2TlsFailure = { code:error.code ?? 'TLS_PEER_VERIFICATION_FAILED',expectedIdentity:name };
      done(error);
    };
    original.call(this, error => {
      if (error) return fail(error);
      try { verifyPhase2Peer(this.stream, name); verified = true; }
      catch (failure) { return fail(failure); }
      done();
    });
  };
  return new Promise((resolve, reject) => {
    connection.connect(error => {
      if (error || !verified) { connection.destroy(); reject(error ?? new Error('Phase 2 TLS identity was not verified')); }
      else resolve(connection.promise());
    });
  });
}
