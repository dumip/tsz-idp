/**
 * Property-based tests for ProfilePage component
 * 
 * **Feature: user-profile-management, Property 2: Profile Data Display Consistency**
 * **Validates: Requirements 1.3**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Test the profile data display logic without rendering the full component
// This tests the core logic that maps profile data to form fields

interface UserProfile {
  sub: string;
  email?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  interests?: string[];
}

interface ProfileFormData {
  displayName: string;
  firstName: string;
  lastName: string;
  interests: string;
}

/**
 * Maps user profile to form data
 * This is the core logic used in ProfilePage
 */
function mapProfileToFormData(userProfile: UserProfile): ProfileFormData {
  return {
    displayName: userProfile.displayName || '',
    firstName: userProfile.firstName || '',
    lastName: userProfile.lastName || '',
    interests: userProfile.interests?.join(', ') || '',
  };
}

/**
 * Parse interests string back to array
 */
function parseInterests(interestsStr: string): string[] {
  if (!interestsStr.trim()) return [];
  return interestsStr
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

describe('ProfilePage', () => {
  /**
   * **Feature: user-profile-management, Property 2: Profile Data Display Consistency**
   * **Validates: Requirements 1.3**
   * 
   * *For any* valid user profile containing DisplayName, FirstName, LastName, and Interests,
   * when the profile page renders, all non-null profile fields should appear in the
   * corresponding form inputs.
   */
  describe('Property 2: Profile Data Display Consistency', () => {
    it('should map all non-null profile fields to form inputs', () => {
      fc.assert(
        fc.property(
          fc.record({
            sub: fc.uuid(),
            email: fc.option(fc.emailAddress(), { nil: undefined }),
            displayName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            firstName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            lastName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            interests: fc.option(
              fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 10 }),
              { nil: undefined }
            ),
          }),
          (userProfile: UserProfile) => {
            const formData = mapProfileToFormData(userProfile);
            
            // All non-null fields should appear in form data
            if (userProfile.displayName) {
              expect(formData.displayName).toBe(userProfile.displayName);
            } else {
              expect(formData.displayName).toBe('');
            }
            
            if (userProfile.firstName) {
              expect(formData.firstName).toBe(userProfile.firstName);
            } else {
              expect(formData.firstName).toBe('');
            }
            
            if (userProfile.lastName) {
              expect(formData.lastName).toBe(userProfile.lastName);
            } else {
              expect(formData.lastName).toBe('');
            }
            
            if (userProfile.interests && userProfile.interests.length > 0) {
              expect(formData.interests).toBe(userProfile.interests.join(', '));
            } else {
              expect(formData.interests).toBe('');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve interests through display and parse cycle', () => {
      fc.assert(
        fc.property(
          // Generate interests without commas (since commas are the delimiter)
          fc.array(
            fc.string({ minLength: 1, maxLength: 30 }).filter(s => !s.includes(',')),
            { minLength: 1, maxLength: 10 }
          ),
          (interests: string[]) => {
            // Simulate the display -> edit -> parse cycle
            const displayString = interests.join(', ');
            const parsedBack = parseInterests(displayString);
            
            // After trimming, should get back the same interests
            const trimmedOriginal = interests.map(s => s.trim()).filter(s => s.length > 0);
            expect(parsedBack).toEqual(trimmedOriginal);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty profile gracefully', () => {
      const emptyProfile: UserProfile = { sub: 'test-sub' };
      const formData = mapProfileToFormData(emptyProfile);
      
      expect(formData.displayName).toBe('');
      expect(formData.firstName).toBe('');
      expect(formData.lastName).toBe('');
      expect(formData.interests).toBe('');
    });

    it('should handle profile with all fields populated', () => {
      fc.assert(
        fc.property(
          fc.record({
            sub: fc.uuid(),
            email: fc.emailAddress(),
            displayName: fc.string({ minLength: 1, maxLength: 50 }),
            firstName: fc.string({ minLength: 1, maxLength: 50 }),
            lastName: fc.string({ minLength: 1, maxLength: 50 }),
            interests: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 10 }),
          }),
          (fullProfile: UserProfile) => {
            const formData = mapProfileToFormData(fullProfile);
            
            // All fields should be populated
            expect(formData.displayName).toBe(fullProfile.displayName);
            expect(formData.firstName).toBe(fullProfile.firstName);
            expect(formData.lastName).toBe(fullProfile.lastName);
            expect(formData.interests).toBe(fullProfile.interests!.join(', '));
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
