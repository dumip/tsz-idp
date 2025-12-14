/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth2 Authorization Code flow
 * Implements RFC 7636 for secure public client authentication
 * 
 * Requirements: 5.1
 */

const PKCE_VERIFIER_KEY = 'login_ui_pkce_verifier';

/**
 * Generate a cryptographically random code verifier
 * Per RFC 7636: 43-128 characters from unreserved URI characters
 * 
 * @param length - Length of the code verifier (default: 64, must be 43-128)
 * @returns A random code verifier string
 */
export function generateCodeVerifier(length: number = 64): string {
  if (length < 43 || length > 128) {
    throw new Error('Code verifier length must be between 43 and 128 characters');
  }

  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);

  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charset.length];
  }

  return result;
}

/**
 * Generate a code challenge from a code verifier using S256 method
 * Per RFC 7636: code_challenge = BASE64URL(SHA256(code_verifier))
 * 
 * @param codeVerifier - The code verifier to hash
 * @returns A promise resolving to the base64url-encoded SHA256 hash
 */
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);

  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  const hashArray = new Uint8Array(hashBuffer);
  const base64 = btoa(String.fromCharCode(...hashArray));
  
  // Convert base64 to base64url: replace + with -, / with _, remove =
  const base64url = base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return base64url;
}

/**
 * Generate a PKCE pair (code_verifier and code_challenge)
 * 
 * @param verifierLength - Length of the code verifier (default: 64)
 * @returns A promise resolving to an object with codeVerifier and codeChallenge
 */
export async function generatePKCEPair(verifierLength: number = 64): Promise<{
  codeVerifier: string;
  codeChallenge: string;
}> {
  const codeVerifier = generateCodeVerifier(verifierLength);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  return {
    codeVerifier,
    codeChallenge,
  };
}

/**
 * Store PKCE verifier in session storage for use after OAuth callback
 */
export function storePKCEVerifier(codeVerifier: string): void {
  sessionStorage.setItem(PKCE_VERIFIER_KEY, codeVerifier);
}

/**
 * Retrieve stored PKCE verifier from session storage
 */
export function getStoredPKCEVerifier(): string | null {
  return sessionStorage.getItem(PKCE_VERIFIER_KEY);
}

/**
 * Clear stored PKCE verifier
 */
export function clearPKCEVerifier(): void {
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
}
