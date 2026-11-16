import { randomUUID } from 'node:crypto';
import { registrationIdentityLockName } from '../backend/src/services/registration.service.js';
import { hashPassword as argon2idHashPassword } from '../backend/src/services/password.service.js';

export const EMPLOYEE_ACCOUNTS = Object.freeze([
  Object.freeze({ username: 'Admin', roleCode: 'admin', name: 'Admin', email: 'admin@enterflow.test', department: 'Administration', jobTitle: 'Administrator' }),
  Object.freeze({ username: 'sales', roleCode: 'sales', name: 'Sales Staff', email: 'sales@enterflow.test', department: 'Sales', jobTitle: 'Sales Staff' }),
  Object.freeze({ username: 'operations', roleCode: 'operations', name: 'Operations Staff', email: 'operations@enterflow.test', department: 'Operations', jobTitle: 'Operations Staff' }),
  Object.freeze({ username: 'accountant', roleCode: 'accounting', name: 'Accounting Staff', email: 'accountant@enterflow.test', department: 'Accounting', jobTitle: 'Accounting Staff' }),
  Object.freeze({ username: 'production', roleCode: 'production', name: 'Production Staff', email: 'production@enterflow.test', department: 'Production', jobTitle: 'Production Staff' }),
  Object.freeze({ username: 'warehouse', roleCode: 'warehouse', name: 'Warehouse Staff', email: 'warehouse@enterflow.test', department: 'Warehouse', jobTitle: 'Warehouse Staff' }),
  Object.freeze({ username: 'logistics', roleCode: 'logistics', name: 'Logistics Staff', email: 'logistics@enterflow.test', department: 'Logistics', jobTitle: 'Logistics Staff' }),
  Object.freeze({ username: 'owner', roleCode: 'owner', name: 'Owner', email: 'owner@enterflow.test', department: 'Executive', jobTitle: 'Owner' })
]);

const userColumns = ['account_type', 'display_name', 'email', 'username', 'phone', 'password_hash',
  'employee_number', 'department', 'job_title', 'active', 'joined_on', 'role_code'];
const auditColumns = ['actor_id', 'action', 'subject_type', 'subject_identifier', 'field_name',
  'old_value', 'new_value', 'reason', 'request_id', 'occurred_at'];
const fail = code => ({ success: false, code });
const affectedOnce = result => result?.affectedRows === 1 && !result.warningStatus;
const canonicalAccounts = Object.freeze(EMPLOYEE_ACCOUNTS.map(({ username, roleCode }) =>
  Object.freeze({ username, roleCode })));
const identityValues = profiles => profiles.flatMap(profile => [profile.username, profile.email]);

export class ProvisioningError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'ProvisioningError';
    this.code = code;
    if (Number.isInteger(details.accountIndex)) this.accountIndex = details.accountIndex;
    if (details.rule) this.rule = details.rule;
  }
}

export function assertLocalDevelopmentTarget(config) {
  if (config?.production || config?.database?.host !== '127.0.0.1' ||
      config?.database?.port !== 3308 || config?.database?.name !== 'enterflow_db') {
    throw new ProvisioningError('UNAUTHORIZED_DATABASE_TARGET');
  }
}

export function validateEmployeeProfiles(profiles = EMPLOYEE_ACCOUNTS) {
  if (!Array.isArray(profiles) || profiles.length !== EMPLOYEE_ACCOUNTS.length) {
    throw new ProvisioningError('INVALID_ACCOUNT_SET');
  }
  const expected = new Map(EMPLOYEE_ACCOUNTS.map(account => [account.username, account.roleCode]));
  const seenUsernames = new Set();
  const seenIdentities = new Set();
  const allowedFields = new Set(['username', 'roleCode', 'name', 'email', 'phone', 'employeeId', 'department', 'jobTitle']);
  const normalized = profiles.map(profile => {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile) ||
        Object.keys(profile).some(key => !allowedFields.has(key))) {
      throw new ProvisioningError('INVALID_ACCOUNT_PROFILE');
    }
    const { username, roleCode } = profile;
    if (expected.get(username) !== roleCode || seenUsernames.has(username)) {
      throw new ProvisioningError('INVALID_ACCOUNT_SET');
    }
    seenUsernames.add(username);
    const text = (value, max, required) => {
      if (value === undefined || value === null) {
        if (required) throw new ProvisioningError('INVALID_ACCOUNT_PROFILE');
        return null;
      }
      if (typeof value !== 'string' || !value.isWellFormed() || [...value.trim()].length > max ||
          (required && !value.trim())) {
        throw new ProvisioningError('INVALID_ACCOUNT_PROFILE');
      }
      return value.trim() || null;
    };
    const name = text(profile.name, 160, true);
    const email = text(profile.email, 254, true)?.toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
      throw new ProvisioningError('INVALID_ACCOUNT_PROFILE');
    }
    const phone = text(profile.phone, 40, false);
    const employeeId = text(profile.employeeId, 80, false);
    const department = text(profile.department, 120, false);
    const jobTitle = text(profile.jobTitle, 120, false);
    return { username, roleCode, name, email, phone, employeeId, department, jobTitle };
  });
  if (seenUsernames.size !== expected.size) throw new ProvisioningError('INVALID_ACCOUNT_SET');
  for (const value of identityValues(normalized)) {
    const key = value.toLocaleLowerCase('en-US');
    if (seenIdentities.has(key)) throw new ProvisioningError('DUPLICATE_PLANNED_IDENTITY');
    seenIdentities.add(key);
  }
  return normalized;
}

export function validateInitialPasswords(passwords) {
  if (!Array.isArray(passwords) || passwords.length !== EMPLOYEE_ACCOUNTS.length) {
    throw new ProvisioningError('INVALID_INITIAL_PASSWORDS', { rule: 'ACCOUNT_COUNT' });
  }
  for (let index = 0; index < passwords.length; index++) {
    validateInitialPassword(passwords[index], index, passwords.slice(0, index));
  }
  return passwords;
}

export function validateInitialPassword(password, accountIndex, previousPasswords = []) {
  const invalid = rule => { throw new ProvisioningError('INVALID_INITIAL_PASSWORDS', { accountIndex, rule }); };
  if (typeof password !== 'string' || password.length === 0) invalid('EMPTY');
  if (password.length < 8) invalid('TOO_SHORT');
  if (password.length > 1024) invalid('TOO_LONG');
  if (previousPasswords.includes(password)) invalid('REUSED');
}

export function validatePasswordConfirmation(password, confirmation, accountIndex) {
  if (password !== confirmation) {
    throw new ProvisioningError('INVALID_INITIAL_PASSWORDS', { accountIndex, rule: 'CONFIRMATION_MISMATCH' });
  }
}

// Only canonical account names and fixed policy text are safe for CLI output.
export function initialPasswordErrorMessage(error) {
  const rules = {
    ACCOUNT_COUNT: 'Exactly eight initial passwords are required.',
    EMPTY: 'A nonempty password is required.',
    TOO_SHORT: 'Use at least 8 characters.',
    TOO_LONG: 'Use at most 1024 characters.',
    REUSED: 'Use a distinct initial password for each account; this password repeats an earlier account.',
    CONFIRMATION_MISMATCH: 'Password and confirmation must match exactly, including spaces.'
  };
  if (error?.code !== 'INVALID_INITIAL_PASSWORDS' || !Object.hasOwn(rules, error.rule)) return '';
  const account = EMPLOYEE_ACCOUNTS[error.accountIndex];
  return `${account ? `Account ${account.username}: ` : ''}${rules[error.rule]}`;
}

function assertColumns(actual, required, table) {
  const names = new Set(actual.filter(column => column.tableName === table).map(column => column.columnName));
  if (required.some(column => !names.has(column))) throw new ProvisioningError('INCOMPATIBLE_ACCOUNT_SCHEMA');
}

async function assertDatabaseAndSchema(connection) {
  let identity;
  try {
    [[identity]] = await connection.execute('SELECT DATABASE() AS databaseName, VERSION() AS serverVersion');
  } catch {
    throw new ProvisioningError('UNAUTHORIZED_DATABASE_TARGET');
  }
  if (identity?.databaseName !== 'enterflow_db' || !/^8\.4\./u.test(identity.serverVersion ?? '')) {
    throw new ProvisioningError('UNAUTHORIZED_DATABASE_TARGET');
  }
  let columns, foreignKeys, indexes, roles;
  try {
    [columns] = await connection.execute(`SELECT TABLE_NAME tableName,COLUMN_NAME columnName,COLUMN_TYPE columnType,
      IS_NULLABLE nullable,CHARACTER_MAXIMUM_LENGTH maxLength
      FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
      AND TABLE_NAME IN ('users','roles','audit_events')`);
    [foreignKeys] = await connection.execute(`SELECT TABLE_NAME tableName,COLUMN_NAME columnName,
      REFERENCED_TABLE_NAME referencedTable,REFERENCED_COLUMN_NAME referencedColumn
      FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE()
      AND TABLE_NAME IN ('users','audit_events') AND REFERENCED_TABLE_NAME IS NOT NULL`);
    [indexes] = await connection.execute(`SELECT TABLE_NAME tableName,INDEX_NAME indexName,NON_UNIQUE nonUnique,
      COLUMN_NAME columnName,SEQ_IN_INDEX sequence FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND NON_UNIQUE=0`);
    [roles] = await connection.execute('SELECT code FROM roles WHERE code IN (?,?,?,?,?,?,?,?)',
      EMPLOYEE_ACCOUNTS.map(account => account.roleCode));
  } catch {
    throw new ProvisioningError('INCOMPATIBLE_ACCOUNT_SCHEMA');
  }
  assertColumns(columns, userColumns, 'users');
  assertColumns(columns, ['code', 'label'], 'roles');
  assertColumns(columns, auditColumns, 'audit_events');
  const accountType = columns.find(column => column.tableName === 'users' && column.columnName === 'account_type');
  const passwordHash = columns.find(column => column.tableName === 'users' && column.columnName === 'password_hash');
  if (accountType?.columnType?.toLowerCase() !== "enum('employee','client')" ||
      passwordHash?.columnType?.toLowerCase() !== 'varchar(255)') {
    throw new ProvisioningError('INCOMPATIBLE_ACCOUNT_SCHEMA');
  }
  if (!columns.some(column => column.tableName === 'audit_events' && column.columnName === 'actor_id' && column.nullable === 'YES')) {
    throw new ProvisioningError('INCOMPATIBLE_ACCOUNT_SCHEMA');
  }
  if (!foreignKeys.some(key => key.tableName === 'users' && key.columnName === 'role_code' &&
      key.referencedTable === 'roles' && key.referencedColumn === 'code')) {
    throw new ProvisioningError('INCOMPATIBLE_ACCOUNT_SCHEMA');
  }
  const uniqueColumns = new Map();
  for (const index of indexes.filter(item => Number(item.nonUnique) === 0)) {
    const columnsForIndex = uniqueColumns.get(index.indexName) ?? [];
    columnsForIndex[Number(index.sequence) - 1] = index.columnName;
    uniqueColumns.set(index.indexName, columnsForIndex);
  }
  for (const column of ['username', 'email']) {
    if (![...uniqueColumns.values()].some(indexColumns => indexColumns.length === 1 && indexColumns[0] === column)) {
      throw new ProvisioningError('INCOMPATIBLE_ACCOUNT_SCHEMA');
    }
  }
  const roleSet = new Set(roles.map(role => role.code));
  if (EMPLOYEE_ACCOUNTS.some(account => !roleSet.has(account.roleCode))) {
    throw new ProvisioningError('REQUIRED_ROLE_MISSING');
  }
}

async function findConflicts(connection, profiles) {
  const conflicts = [];
  for (const profile of profiles) {
    const parameters = [profile.email, profile.username, profile.email, profile.username];
    let users, applications;
    try {
      [users] = await connection.execute('SELECT 1 FROM users WHERE email IN (?,?) OR username IN (?,?) LIMIT 1', parameters);
      [applications] = await connection.execute(`SELECT 1 FROM client_applications
        WHERE status IN ('pending','approved') AND (email IN (?,?) OR username IN (?,?)) LIMIT 1`, parameters);
    } catch {
      throw new ProvisioningError('INCOMPATIBLE_ACCOUNT_SCHEMA');
    }
    if (users.length || applications.length) conflicts.push(profile.username);
  }
  return conflicts;
}

async function inspect(connection, profiles) {
  await assertDatabaseAndSchema(connection);
  return findConflicts(connection, profiles);
}

export async function previewEmployeeProvisioning({ connection, profiles = EMPLOYEE_ACCOUNTS }) {
  const validated = validateEmployeeProfiles(profiles);
  const conflicts = await inspect(connection, validated);
  return {
    success: true,
    status: conflicts.length ? 'blocked' : 'ready',
    accounts: canonicalAccounts,
    conflicts
  };
}

export async function provisionEmployeeAccounts({
  db,
  profiles = EMPLOYEE_ACCOUNTS,
  passwords,
  operator,
  hash = argon2idHashPassword,
  lockTimeoutSeconds = 2
}) {
  const validated = validateEmployeeProfiles(profiles);
  validateInitialPasswords(passwords);
  const secretInputs = [...passwords];
  passwords.fill('');
  if (typeof operator !== 'string' || !operator.trim() || operator.length > 120 || /[\u0000-\u001f\u007f]/u.test(operator)) {
    secretInputs.fill('');
    throw new ProvisioningError('INVALID_OPERATOR');
  }
  if (!db || typeof db.getConnection !== 'function' || typeof hash !== 'function' ||
      !Number.isSafeInteger(lockTimeoutSeconds) || lockTimeoutSeconds < 0 || lockTimeoutSeconds > 10) {
    secretInputs.fill('');
    throw new ProvisioningError('INVALID_PROVISIONING_CONFIGURATION');
  }

  let preflightConnection;
  let preflightConflicts;
  try {
    preflightConnection = await db.getConnection();
    preflightConflicts = await inspect(preflightConnection, validated);
  } catch (error) {
    secretInputs.fill('');
    throw error;
  } finally {
    if (preflightConnection) preflightConnection.release();
  }
  if (preflightConflicts.length) {
    secretInputs.fill('');
    return { ...fail('IDENTITY_CONFLICT'), conflicts: preflightConflicts };
  }

  const passwordHashes = [];
  try {
    for (let i = 0; i < secretInputs.length; i++) {
      const password = secretInputs[i];
      const hashValue = await hash(password);
      if (typeof hashValue !== 'string' || !hashValue.startsWith('$argon2id$') || hashValue.length > 255) {
        throw new ProvisioningError('PASSWORD_HASH_FAILED');
      }
      passwordHashes.push(hashValue);
      secretInputs[i] = '';
    }
  } catch (error) {
    secretInputs.fill('');
    if (error instanceof ProvisioningError) throw error;
    throw new ProvisioningError('PASSWORD_HASH_FAILED');
  }

  let connection;
  let lockName;
  let lockAttempted = false;
  let locked = false;
  let transaction = false;
  let reusable = true;
  let commitAttempted = false;
  let result = fail('PROVISIONING_FAILED');
  const requestId = randomUUID();
  try {
    connection = await db.getConnection();
    const [[database]] = await connection.execute('SELECT DATABASE() AS databaseName');
    if (database?.databaseName !== 'enterflow_db') throw new ProvisioningError('UNAUTHORIZED_DATABASE_TARGET');
    lockName = registrationIdentityLockName(database.databaseName);
    lockAttempted = true;
    const [[lock]] = await connection.execute('SELECT GET_LOCK(?, ?) AS acquired', [lockName, lockTimeoutSeconds]);
    locked = lock?.acquired === 1 || lock?.acquired === '1';
    if (!locked) {
      reusable = false;
      result = fail('LOCK_UNAVAILABLE');
    } else {
      await connection.beginTransaction();
      transaction = true;
      const conflicts = await inspect(connection, validated);
      if (conflicts.length) {
        result = { ...fail('IDENTITY_CONFLICT'), conflicts };
      } else {
        for (let i = 0; i < validated.length; i++) {
          const profile = validated[i];
          const [insert] = await connection.execute(`INSERT INTO users
            (role_code,account_type,display_name,email,username,phone,password_hash,employee_number,department,job_title,active,joined_on)
            VALUES (?,'employee',?,?,?,?,?,?,?,?,TRUE,UTC_DATE())`,
          [profile.roleCode, profile.name, profile.email, profile.username, profile.phone,
            passwordHashes[i], profile.employeeId, profile.department, profile.jobTitle]);
          if (!affectedOnce(insert)) throw new ProvisioningError('PROVISIONING_FAILED');
          const [[inserted]] = await connection.execute('SELECT CAST(LAST_INSERT_ID() AS CHAR) id');
          if (!/^[1-9]\d{0,19}$/u.test(inserted?.id ?? '')) throw new ProvisioningError('PROVISIONING_FAILED');
          const [audit] = await connection.execute(`INSERT INTO audit_events
            (actor_id,action,subject_type,subject_identifier,field_name,old_value,new_value,reason,request_id,occurred_at)
            VALUES (NULL,'employee.provisioned','user',?,NULL,NULL,?,?,?,UTC_TIMESTAMP(3))`,
          [inserted.id, JSON.stringify({ username: profile.username, roleCode: profile.roleCode }),
            `Local development employee provisioning by ${operator.trim()}`, requestId]);
          if (!affectedOnce(audit)) throw new ProvisioningError('PROVISIONING_FAILED');
        }
        commitAttempted = true;
        await connection.commit();
        transaction = false;
        result = { success: true, status: 'provisioned', count: validated.length, accounts: canonicalAccounts, requestId };
      }
    }
  } catch (error) {
    reusable = false;
    if (error instanceof ProvisioningError) result = fail(error.code);
    else if (error?.code === 'ER_DUP_ENTRY') result = fail('IDENTITY_CONFLICT');
    else result = fail(commitAttempted ? 'WRITE_OUTCOME_UNKNOWN' : 'PROVISIONING_FAILED');
  } finally {
    secretInputs.fill('');
    if (connection) {
      if (transaction) {
        try { await connection.rollback(); } catch { reusable = false; result = fail('PROVISIONING_FAILED'); }
      }
      if (locked) {
        try {
          const [[released]] = await connection.execute('SELECT RELEASE_LOCK(?) AS released', [lockName]);
          if (released?.released !== 1 && released?.released !== '1') reusable = false;
        } catch { reusable = false; }
      } else if (lockAttempted) {
        reusable = false;
      }
      try { reusable ? connection.release() : connection.destroy(); }
      catch { try { connection.destroy(); } catch {} }
    }
    passwordHashes.fill('');
  }
  return result;
}
