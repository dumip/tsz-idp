/**
 * Property-based tests for authentication service
 * 
 * **Feature: user-profile-management, Property 1: Authentication Guard**
 * **Validates: Requirements 1.2, 5.1**
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { getAuthState, isAuthenticated, extractUserProfile, type IdTokenClaims } from './auth';

// Mock sessionStorage
const mockSessionStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
});

describe('Auth Service', () => {
  beforeEach(() => {
    mockSessionStorage.clear();
    vi.clearAllMocks();
  });

  /**
   * **Feature: user-profile-management, Property 1: Authentication Guard**
   * **Validates: Requirements 1.2, 5.1**
   * 
   * *For any* unauthenticated user state, when accessing the /profile route,
   * the system should initiate an OAuth2 redirect to Cognito Managed Login
   * rather than displaying the profile form.
   */
  describe('Property 1: Authentication Guard', () => {
    it('should return null for any empty or missing auth state', () => {
      fc.assert(
        fc.property(
          // Test various invalid storage states
          fc.constantFrom(null, undefined, '', 'invalid-json', '{"partial": true}'),
          (storedValue) => {
            mockSessionStorage.clear();
            if (storedValue !== null && storedValue !== undefined) {
              mockSessionStorage.setItem('login_ui_auth_state', storedValue);
            }
            
            const authState = getAuthState();
            expect(authState).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null for any expired auth state', () => {
      fc.assert(
        fc.property(
          fc.record({
            accessToken: fc.string({ minLength: 1 }),
            idToken: fc.string({ minLength: 1 }),
            refreshToken: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
            // Generate expiration times in the past
            expiresAt: fc.integer({ min: 0, max: Date.now() - 1 }),
            userProfile: fc.record({
              sub: fc.uuid(),
              email: fc.option(fc.emailAddress(), { nil: undefined }),
              displayName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
              firstName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
              lastName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
              interests: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 10 }), { nil: undefined }),
            }),
          }),
          (expiredState) => {
            mockSessionStorage.clear();
            mockSessionStorage.setItem('login_ui_auth_state', JSON.stringify(expiredState));
            
            const authState = getAuthState();
            expect(authState).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return false for isAuthenticated when no valid session exists', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(null, '', 'invalid', '{"expiresAt": 0}'),
          (storedValue) => {
            mockSessionStorage.clear();
            if (storedValue !== null) {
              mockSessionStorage.setItem('login_ui_auth_state', storedValue);
            }
            
            expect(isAuthenticated()).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return valid auth state for any non-expired session', () => {
      fc.assert(
        fc.property(
          fc.record({
            accessToken: fc.string({ minLength: 10 }),
            idToken: fc.string({ minLength: 10 }),
            refreshToken: fc.option(fc.string({ minLength: 10 }), { nil: undefined }),
            // Generate expiration times in the future
            expiresAt: fc.integer({ min: Date.now() + 1000, max: Date.now() + 3600000 }),
            userProfile: fc.record({
              sub: fc.uuid(),
              email: fc.option(fc.emailAddress(), { nil: undefined }),
              displayName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
              firstName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
              lastName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
              interests: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 10 }), { nil: undefined }),
            }),
          }),
          (validState) => {
            mockSessionStorage.clear();
            mockSessionStorage.setItem('login_ui_auth_state', JSON.stringify(validState));
            
            const authState = getAuthState();
            expect(authState).not.toBeNull();
            expect(authState?.accessToken).toBe(validState.accessToken);
            expect(isAuthenticated()).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('extractUserProfile', () => {
    it('should correctly extract profile from any valid ID token claims', () => {
      fc.assert(
        fc.property(
          fc.record({
            sub: fc.uuid(),
            iss: fc.webUrl(),
            aud: fc.string({ minLength: 1 }),
            exp: fc.integer({ min: 1 }),
            iat: fc.integer({ min: 1 }),
            email: fc.option(fc.emailAddress(), { nil: undefined }),
            email_verified: fc.option(fc.boolean(), { nil: undefined }),
            'custom:displayName': fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            'custom:firstName': fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            'custom:lastName': fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            'custom:interests': fc.option(
              fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 10 }).map(arr => JSON.stringify(arr)),
              { nil: undefined }
            ),
          }),
          (claims) => {
            const profile = extractUserProfile(claims as IdTokenClaims);
            
            expect(profile.sub).toBe(claims.sub);
            expect(profile.email).toBe(claims.email);
            expect(profile.displayName).toBe(claims['custom:displayName']);
            expect(profile.firstName).toBe(claims['custom:firstName']);
            expect(profile.lastName).toBe(claims['custom:lastName']);
            
            if (claims['custom:interests']) {
              expect(profile.interests).toEqual(JSON.parse(claims['custom:interests']));
            } else {
              expect(profile.interests).toBeUndefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
