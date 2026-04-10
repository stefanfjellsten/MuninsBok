/**
 * Password hashing using Node.js built-in crypto.scrypt.
 *
 * Uses scrypt key derivation with a random 16-byte salt and 64-byte key.
 * Passwords are stored as `v2:salt:hash` (hex-encoded).
 * Legacy format `salt:hash` (v1, N=2^14) is supported for verification
 * and will be rehashed on next successful login.
 * Verification uses crypto.timingSafeEqual to prevent timing attacks.
 */
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

// v2: OWASP-recommended scrypt cost (N = 2^17)
const SCRYPT_COST_V2 = 131072; // 2^17

// v1: legacy cost (N = 2^14) — for verifying old hashes only
const SCRYPT_COST_V1 = 16384; // 2^14

interface ScryptOptions {
  readonly N: number;
  readonly r: number;
  readonly p: number;
  readonly maxmem: number;
}

function makeScryptOptions(cost: number): ScryptOptions {
  return { N: cost, r: 8, p: 1, maxmem: 128 * cost * 8 * 2 };
}

const SCRYPT_OPTIONS_V2: ScryptOptions = makeScryptOptions(SCRYPT_COST_V2);
const SCRYPT_OPTIONS_V1: ScryptOptions = makeScryptOptions(SCRYPT_COST_V1);

function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * Hash a plaintext password.
 * @returns A string in the format `v2:salt:hash` (hex-encoded).
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const hash = await scryptAsync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS_V2);
  return `v2:${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * Verify a plaintext password against a stored hash.
 * Supports both v2 (`v2:salt:hash`) and legacy v1 (`salt:hash`) formats.
 * @param password  The plaintext password to check.
 * @param stored    The stored hash string from hashPassword().
 * @returns `true` if the password matches.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  let saltHex: string | undefined;
  let hashHex: string | undefined;
  let options: ScryptOptions;

  if (stored.startsWith("v2:")) {
    // v2 format: "v2:salt:hash"
    const parts = stored.slice(3).split(":");
    saltHex = parts[0];
    hashHex = parts[1];
    options = SCRYPT_OPTIONS_V2;
  } else {
    // Legacy v1 format: "salt:hash"
    const parts = stored.split(":");
    saltHex = parts[0];
    hashHex = parts[1];
    options = SCRYPT_OPTIONS_V1;
  }

  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const storedHash = Buffer.from(hashHex, "hex");
  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH, options);

  if (derivedKey.length !== storedHash.length) return false;

  return timingSafeEqual(derivedKey, storedHash);
}

/**
 * Check whether a stored hash uses the latest hash format (v2).
 * If false, the password should be rehashed on next successful login.
 */
export function needsRehash(stored: string): boolean {
  return !stored.startsWith("v2:");
}
