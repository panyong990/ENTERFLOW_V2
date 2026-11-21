// Classify only the expected constraint, never every ER_DUP_ENTRY (e.g. a PK).
// Raw database messages are inspected locally and never returned or logged.
export function isDuplicateKey(error, allowedKeys) {
  if (error?.code !== 'ER_DUP_ENTRY') return false;
  const message = error.sqlMessage ?? error.message;
  if (typeof message !== 'string') return false;
  const match = /for key ['`]([^'`]+)['`]\s*$/i.exec(message);
  return Boolean(match && allowedKeys.includes(match[1].split('.').at(-1)));
}
