import argon2 from 'argon2';

const options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
};

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('A valid password is required.');
  }

  return argon2.hash(password, options);
}

export async function verifyPassword(passwordHash, password) {
  if (
    typeof passwordHash !== 'string' ||
    typeof password !== 'string'
  ) {
    return false;
  }

  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}
