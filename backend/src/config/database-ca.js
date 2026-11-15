import fs from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const defaultCaPath = fileURLToPath(new URL('../../certs/ca.pem', import.meta.url));

export function resolveDatabaseCaPath(configuredPath) {
  return configuredPath ? resolve(repositoryRoot, configuredPath) : defaultCaPath;
}

export function loadDatabaseCa({ configuredPath, readFile = fs.readFileSync } = {}) {
  const path = resolveDatabaseCaPath(configuredPath);
  const ca = readFile(path, 'utf8');

  if (typeof ca !== 'string' || !ca.trim()) {
    throw new Error('Database CA certificate is empty.');
  }

  return { path, ca };
}
