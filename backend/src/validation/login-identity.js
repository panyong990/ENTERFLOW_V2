// Keep username spelling; MySQL's declared collation defines identity equality.
export const normalizeEmail = value => value.trim().toLowerCase();
export const normalizeUsername = value => value.trim();
