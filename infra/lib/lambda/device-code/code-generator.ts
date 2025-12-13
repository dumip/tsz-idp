import * as crypto from 'crypto';

/**
 * Device Code Generator
 * 
 * Generates unique device codes and user codes per RFC 8628.
 * - device_code: Cryptographically secure random string (32 hex chars)
 * - user_code: User-friendly alphanumeric code (8 chars, no ambiguous chars)
 */

// Characters for user code - excludes ambiguous chars (0, O, 1, I, L)
const USER_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const USER_CODE_LENGTH = 8;
const DEVICE_CODE_LENGTH = 32; // 32 hex chars = 128 bits

/**
 * Generates a cryptographically secure device code
 * @returns 32-character hex string
 */
export function generateDeviceCode(): string {
  return crypto.randomBytes(DEVICE_CODE_LENGTH / 2).toString('hex');
}

/**
 * Generates a user-friendly code for display
 * Format: XXX-XXXX (8 chars with hyphen for readability)
 * @returns 8-character alphanumeric string (formatted as XXX-XXXX)
 */
export function generateUserCode(): string {
  const bytes = crypto.randomBytes(USER_CODE_LENGTH);
  let code = '';
  
  for (let i = 0; i < USER_CODE_LENGTH; i++) {
    const index = bytes[i] % USER_CODE_CHARS.length;
    code += USER_CODE_CHARS[index];
  }
  
  // Format as XXX-XXXX for readability
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

/**
 * Validates a device code format
 * @param code The device code to validate
 * @returns true if valid format
 */
export function isValidDeviceCode(code: string): boolean {
  return typeof code === 'string' && /^[a-f0-9]{32}$/i.test(code);
}

/**
 * Validates a user code format
 * @param code The user code to validate (with or without hyphen)
 * @returns true if valid format
 */
export function isValidUserCode(code: string): boolean {
  if (typeof code !== 'string') return false;
  // Remove hyphen for validation
  const normalized = code.replace(/-/g, '').toUpperCase();
  if (normalized.length !== USER_CODE_LENGTH) return false;
  
  // Check all characters are in allowed set
  for (const char of normalized) {
    if (!USER_CODE_CHARS.includes(char)) return false;
  }
  return true;
}

/**
 * Normalizes a user code (removes hyphens, converts to uppercase)
 * @param code The user code to normalize
 * @returns Normalized user code
 */
export function normalizeUserCode(code: string): string {
  return code.replace(/-/g, '').toUpperCase();
}
