/**
 * URL validation utilities for secure redirect handling
 * 
 * Requirements: 3.4
 */

/**
 * Get trusted origins from environment variable
 * Format: comma-separated list of origins (e.g., "https://app1.example.com,https://app2.example.com")
 */
export function getTrustedOrigins(): string[] {
  const envOrigins = import.meta.env.VITE_TRUSTED_ORIGINS || '';
  if (!envOrigins) {
    return [];
  }
  return envOrigins
    .split(',')
    .map((origin: string) => origin.trim())
    .filter((origin: string) => origin.length > 0);
}

/**
 * Extract origin from a URL string
 * Returns null if URL is invalid
 */
export function extractOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Check if a URL is from a trusted origin
 * Trusted origins include:
 * - Same origin as current window
 * - Origins configured in VITE_TRUSTED_ORIGINS environment variable
 * 
 * Requirements: 3.4
 * 
 * @param url - The URL to validate
 * @returns true if the URL is from a trusted origin, false otherwise
 */
export function isValidReturnUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const urlOrigin = extractOrigin(url);
  if (!urlOrigin) {
    return false;
  }

  // Check same origin
  if (typeof window !== 'undefined' && urlOrigin === window.location.origin) {
    return true;
  }

  // Check configured trusted origins
  const trustedOrigins = getTrustedOrigins();
  return trustedOrigins.includes(urlOrigin);
}

/**
 * Validate and sanitize a return URL
 * Returns the URL if valid, null otherwise
 * 
 * @param url - The URL to validate
 * @returns The validated URL or null if invalid
 */
export function validateReturnUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  if (isValidReturnUrl(url)) {
    return url;
  }

  return null;
}
