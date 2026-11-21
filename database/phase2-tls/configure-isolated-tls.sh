#!/bin/sh
set -eu
# Explicitly scoped, one-time installation; never overwrite an existing key set.
test "${HOSTNAME:-}" = '2acac2d1b606'
test -d /var/lib/mysql
test ! -e /var/lib/mysql/enterflow-phase2-tls-v1
test ! -e /etc/mysql/conf.d/enterflow-phase2-tls.cnf
test -f /tmp/enterflow-phase2-tls.cnf
umask 077
tlsdir=/var/lib/mysql/enterflow-phase2-tls-v1
mkdir "$tlsdir"
openssl genrsa -out "$tlsdir/ca-key.pem" 3072
openssl req -new -x509 -sha256 -days 3650 -key "$tlsdir/ca-key.pem" -out "$tlsdir/ca.pem" \
  -subj '/CN=EnterFlow Phase2 Local Development CA' \
  -addext 'basicConstraints=critical,CA:TRUE,pathlen:0' \
  -addext 'keyUsage=critical,keyCertSign,cRLSign' \
  -addext 'subjectKeyIdentifier=hash'
openssl genrsa -out "$tlsdir/server-key.pem" 3072
openssl req -new -sha256 -key "$tlsdir/server-key.pem" -out "$tlsdir/server.csr" -subj '/CN=localhost'
cat > "$tlsdir/server.ext" <<'EOF'
[server_ext]
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=IP:127.0.0.1,DNS:localhost
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
EOF
openssl x509 -req -in "$tlsdir/server.csr" -CA "$tlsdir/ca.pem" -CAkey "$tlsdir/ca-key.pem" \
  -CAcreateserial -out "$tlsdir/server-cert.pem" -days 825 -sha256 -extfile "$tlsdir/server.ext" -extensions server_ext
openssl verify -purpose sslserver -CAfile "$tlsdir/ca.pem" -verify_ip 127.0.0.1 "$tlsdir/server-cert.pem"
openssl verify -purpose sslserver -CAfile "$tlsdir/ca.pem" -verify_hostname localhost "$tlsdir/server-cert.pem"
chown root:mysql "$tlsdir"
chmod 750 "$tlsdir"
chown mysql:mysql "$tlsdir/server-key.pem" "$tlsdir/server-cert.pem" "$tlsdir/ca.pem"
chmod 600 "$tlsdir/server-key.pem" "$tlsdir/ca-key.pem"
chmod 644 "$tlsdir/server-cert.pem" "$tlsdir/ca.pem"
install -m 644 /tmp/enterflow-phase2-tls.cnf /etc/mysql/conf.d/enterflow-phase2-tls.cnf
openssl x509 -in "$tlsdir/server-cert.pem" -noout -subject -issuer -serial -dates -ext subjectAltName,extendedKeyUsage
