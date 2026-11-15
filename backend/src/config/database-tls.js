import { connect, isIP } from 'node:net';

const LOCAL_MYSQL_IDENTITY = 'MySQL_Server_8.4.13_Auto_Generated_Server_Certificate';

// mysql2 3.24.6 checks config.host when ssl.verifyIdentity is enabled; it does
// not support ssl.servername. Its public stream factory lets the TCP endpoint
// differ from that verified name without a DNS or certificate change.
export function createDatabaseTlsOptions({ host, port, ca, expectedIdentity, production = false }) {
  if (typeof host !== 'string' || !host || !Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('A valid database TCP endpoint is required.');
  }
  const local = !production && ['127.0.0.1', 'localhost', '::1'].includes(host);
  const identity = expectedIdentity ?? (local ? LOCAL_MYSQL_IDENTITY : host);
  // The installed driver skips its explicit identity check for IP config.host.
  // Require a named certificate identity rather than silently accepting that.
  if (typeof identity !== 'string' || !identity || identity !== identity.trim() ||
      /[\s\u0000-\u001f\u007f*\/\\]/u.test(identity) || isIP(identity)) {
    throw new Error('DB_SSL_SERVER_NAME must specify the expected named certificate identity.');
  }
  if (!(typeof ca === 'string' && ca.trim()) && !(Buffer.isBuffer(ca) && ca.length)) {
    throw new Error('A trusted database CA certificate is required.');
  }

  return {
    host: identity,
    port,
    ssl: { ca, rejectUnauthorized: true, verifyIdentity: true },
    stream({ config }) {
      const socket = connect({ host, port });
      socket.setNoDelay(true);
      if (config.enableKeepAlive) {
        socket.on('connect', () => socket.setKeepAlive(true, config.keepAliveInitialDelay));
      }
      return socket;
    }
  };
}
