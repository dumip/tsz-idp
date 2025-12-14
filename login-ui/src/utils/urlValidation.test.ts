/**
 * Property-based tests for URL validation
 * 
 * **Feature: user-profile-management, Property 5: Untrusted Origin Rejection**
 * **Validates: Requirements 3.4**
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { isValidReturnUrl, extractOrigin, validateReturnUrl } from './urlValidation';

// Mock window.location
const mockWindowLocation = {
  origin: 'https://login.thesafezone.com',
};

// Store original window.location
const originalLocation = window.location;

describe('URL Validation', () => {
  beforeEach(() => {
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: mockWindowLocation,
      writable: true,
    });
    
    // Reset environment variable
    vi.stubEnv('VITE_TRUSTED_ORIGINS', 'https://app.thesafezone.com,https://sample.thesafezone.com');
  });

  afterEach(() => {
    // Restore window.location
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
    vi.unstubAllEnvs();
  });

  describe('extractOrigin', () => {
    it('should extract origin from any valid URL', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          (url) => {
            const origin = extractOrigin(url);
            expect(origin).not.toBeNull();
            // Origin should be protocol + host
            expect(origin).toMatch(/^https?:\/\/[^/]+$/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null for truly invalid URLs', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'not-a-url',
            '//missing-protocol.com',
            '',
            'just some text',
            '   '
          ),
          (invalidUrl) => {
            const origin = extractOrigin(invalidUrl);
            expect(origin).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: user-profile-management, Property 5: Untrusted Origin Rejection**
   * **Validates: Requirements 3.4**
   * 
   * *For any* return_url that is not from a trusted origin (same origin or
   * configured trusted domains), the system should reject the redirect and
   * display an error message instead of redirecting.
   */
  describe('Property 5: Untrusted Origin Rejection', () => {
    it('should accept URLs from same origin', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('/profile', '/settings', '/callback', '/profile?foo=bar'),
          (path) => {
            const url = `${mockWindowLocation.origin}${path}`;
            expect(isValidReturnUrl(url)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept URLs from configured trusted origins', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'https://app.thesafezone.com',
            'https://sample.thesafezone.com'
          ),
          fc.constantFrom('/profile', '/callback', '/home', ''),
          (origin, path) => {
            const url = `${origin}${path}`;
            expect(isValidReturnUrl(url)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject URLs from untrusted origins', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'https://evil.com',
            'https://phishing.thesafezone.com.evil.com',
            'https://thesafezone.com.evil.com',
            'http://app.thesafezone.com', // HTTP instead of HTTPS
            'https://malicious-site.org',
            'https://attacker.io'
          ),
          fc.constantFrom('/profile', '/callback', ''),
          (untrustedOrigin, path) => {
            const url = `${untrustedOrigin}${path}`;
            expect(isValidReturnUrl(url)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid URL formats', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            '',
            'not-a-url',
            'javascript:alert(1)',
            '//no-protocol.com/path',
            'data:text/html,<script>alert(1)</script>'
          ),
          (invalidUrl) => {
            expect(isValidReturnUrl(invalidUrl)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject null and undefined', () => {
      expect(isValidReturnUrl(null as unknown as string)).toBe(false);
      expect(isValidReturnUrl(undefined as unknown as string)).toBe(false);
    });

    it('should handle subdomain attacks', () => {
      // Attacker tries to use subdomains that look like trusted domains
      fc.assert(
        fc.property(
          fc.constantFrom(
            'https://thesafezone.com.attacker.com',
            'https://app.thesafezone.com.attacker.com',
            'https://login.thesafezone.com.evil.org',
            'https://fake-thesafezone.com'
          ),
          (attackUrl) => {
            expect(isValidReturnUrl(attackUrl)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('validateReturnUrl', () => {
    it('should return valid URLs unchanged', () => {
      const validUrl = 'https://app.thesafezone.com/profile';
      expect(validateReturnUrl(validUrl)).toBe(validUrl);
    });

    it('should return null for invalid URLs', () => {
      expect(validateReturnUrl('https://evil.com/steal')).toBeNull();
    });

    it('should return null for null/undefined input', () => {
      expect(validateReturnUrl(null)).toBeNull();
      expect(validateReturnUrl(undefined)).toBeNull();
    });
  });
});
