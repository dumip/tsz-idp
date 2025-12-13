/**
 * Property-based tests for PKCE utilities
 * 
 * **Feature: thesafezone-idp, Property 1: PKCE Validation**
 * **Validates: Requirements 1.1**
 * 
 * Tests that:
 * - Code verifiers are generated with correct length and character set
 * - Code challenges are correctly computed using S256 method
 * - Round-trip validation works (verifier -> challenge -> verification)
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generatePKCEPair,
  isValidCodeVerifier,
} from './pkce';

describe('PKCE Utilities', () => {
  /**
   * **Feature: thesafezone-idp, Property 1: PKCE Validation**
   * **Validates: Requirements 1.1**
   * 
   * Property: For any valid length (43-128), generateCodeVerifier produces
   * a string that passes isValidCodeVerifier
   */
  it('generated code verifiers are always valid', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 43, max: 128 }),
        async (length) => {
          const verifier = generateCodeVerifier(length);
          
          // Verifier should have the requested length
          expect(verifier.length).toBe(length);
          
          // Verifier should pass validation
          expect(isValidCodeVerifier(verifier)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: thesafezone-idp, Property 1: PKCE Validation**
   * **Validates: Requirements 1.1**
   * 
   * Property: Code verifiers only contain allowed characters per RFC 7636
   * Allowed: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
   */
  it('code verifiers contain only RFC 7636 allowed characters', async () => {
    const allowedChars = /^[A-Za-z0-9\-._~]+$/;
    
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 43, max: 128 }),
        async (length) => {
          const verifier = generateCodeVerifier(length);
          expect(allowedChars.test(verifier)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: thesafezone-idp, Property 1: PKCE Validation**
   * **Validates: Requirements 1.1**
   * 
   * Property: Code challenges are base64url encoded (no +, /, or = characters)
   */
  it('code challenges are valid base64url format', async () => {
    const base64urlPattern = /^[A-Za-z0-9\-_]+$/;
    
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 43, max: 128 }),
        async (length) => {
          const verifier = generateCodeVerifier(length);
          const challenge = await generateCodeChallenge(verifier);
          
          // Challenge should be base64url encoded (no +, /, or =)
          expect(base64urlPattern.test(challenge)).toBe(true);
          
          // SHA-256 produces 32 bytes, base64url encoded = 43 characters
          expect(challenge.length).toBe(43);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: thesafezone-idp, Property 1: PKCE Validation**
   * **Validates: Requirements 1.1**
   * 
   * Property: Same verifier always produces the same challenge (deterministic)
   */
  it('code challenge generation is deterministic', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 43, max: 128 }),
        async (length) => {
          const verifier = generateCodeVerifier(length);
          const challenge1 = await generateCodeChallenge(verifier);
          const challenge2 = await generateCodeChallenge(verifier);
          
          expect(challenge1).toBe(challenge2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: thesafezone-idp, Property 1: PKCE Validation**
   * **Validates: Requirements 1.1**
   * 
   * Property: Different verifiers produce different challenges (collision resistance)
   */
  it('different verifiers produce different challenges', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 43, max: 128 }),
        fc.integer({ min: 43, max: 128 }),
        async (length1, length2) => {
          const verifier1 = generateCodeVerifier(length1);
          const verifier2 = generateCodeVerifier(length2);
          
          // Skip if verifiers happen to be the same (extremely unlikely)
          if (verifier1 === verifier2) return true;
          
          const challenge1 = await generateCodeChallenge(verifier1);
          const challenge2 = await generateCodeChallenge(verifier2);
          
          expect(challenge1).not.toBe(challenge2);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: thesafezone-idp, Property 1: PKCE Validation**
   * **Validates: Requirements 1.1**
   * 
   * Property: generatePKCEPair returns a valid pair
   */
  it('generatePKCEPair produces valid verifier and challenge', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 43, max: 128 }),
        async (length) => {
          const { codeVerifier, codeChallenge } = await generatePKCEPair(length);
          
          // Verifier should be valid
          expect(isValidCodeVerifier(codeVerifier)).toBe(true);
          expect(codeVerifier.length).toBe(length);
          
          // Challenge should match what we'd compute from the verifier
          const expectedChallenge = await generateCodeChallenge(codeVerifier);
          expect(codeChallenge).toBe(expectedChallenge);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: thesafezone-idp, Property 1: PKCE Validation**
   * **Validates: Requirements 1.1**
   * 
   * Property: Invalid length throws error
   */
  it('rejects invalid verifier lengths', () => {
    expect(() => generateCodeVerifier(42)).toThrow();
    expect(() => generateCodeVerifier(129)).toThrow();
    expect(() => generateCodeVerifier(0)).toThrow();
    expect(() => generateCodeVerifier(-1)).toThrow();
  });

  /**
   * **Feature: thesafezone-idp, Property 1: PKCE Validation**
   * **Validates: Requirements 1.1**
   * 
   * Property: isValidCodeVerifier correctly rejects invalid verifiers
   */
  it('isValidCodeVerifier rejects invalid inputs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // Too short
          fc.string({ minLength: 0, maxLength: 42 }),
          // Too long
          fc.string({ minLength: 129, maxLength: 200 }),
          // Contains invalid characters
          fc.string({ minLength: 43, maxLength: 128 }).filter(s => /[^A-Za-z0-9\-._~]/.test(s))
        ),
        async (invalidVerifier) => {
          expect(isValidCodeVerifier(invalidVerifier)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
