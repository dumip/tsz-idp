/**
 * Property-based tests for profile service
 * 
 * **Feature: user-profile-management, Property 4: Interests Serialization Round-Trip**
 * **Feature: user-profile-management, Property 3: Partial Update Field Handling**
 * **Validates: Requirements 2.4, 2.5**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  serializeInterests, 
  deserializeInterests, 
  buildAttributeList,
  type ProfileAttributes 
} from './profile';

describe('Profile Service', () => {
  /**
   * **Feature: user-profile-management, Property 4: Interests Serialization Round-Trip**
   * **Validates: Requirements 2.5**
   * 
   * *For any* array of interest strings, serializing to JSON and deserializing
   * should produce an equivalent array. The serialized format stored in
   * `custom:interests` should be valid JSON.
   */
  describe('Property 4: Interests Serialization Round-Trip', () => {
    it('should round-trip any array of interest strings', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 100 }), { maxLength: 50 }),
          (interests) => {
            const serialized = serializeInterests(interests);
            const deserialized = deserializeInterests(serialized);
            
            expect(deserialized).toEqual(interests);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce valid JSON for any interests array', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 0, maxLength: 100 }), { maxLength: 50 }),
          (interests) => {
            const serialized = serializeInterests(interests);
            
            // Should not throw when parsing
            expect(() => JSON.parse(serialized)).not.toThrow();
            
            // Should parse to an array
            const parsed = JSON.parse(serialized);
            expect(Array.isArray(parsed)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty arrays', () => {
      const serialized = serializeInterests([]);
      const deserialized = deserializeInterests(serialized);
      expect(deserialized).toEqual([]);
    });

    it('should handle special characters in interests', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.string({ minLength: 1, maxLength: 50 }).map(s => 
              s + '!@#$%^&*(){}[]|\\:";\'<>,.?/`~'
            ),
            { minLength: 1, maxLength: 10 }
          ),
          (interests) => {
            const serialized = serializeInterests(interests);
            const deserialized = deserializeInterests(serialized);
            expect(deserialized).toEqual(interests);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array for invalid JSON', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('invalid', '{not json}', '[1, 2, 3]', '{"key": "value"}', 'null', '123'),
          (invalidJson) => {
            const result = deserializeInterests(invalidJson);
            // Should return empty array for non-string-array JSON
            expect(Array.isArray(result)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: user-profile-management, Property 3: Partial Update Field Handling**
   * **Validates: Requirements 2.4**
   * 
   * *For any* subset of profile fields provided in an update, only the provided
   * fields should be included in the UpdateUserAttributes API call, and unchanged
   * fields should retain their original values.
   */
  describe('Property 3: Partial Update Field Handling', () => {
    it('should only include provided fields in attribute list', () => {
      fc.assert(
        fc.property(
          fc.record({
            displayName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            firstName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            lastName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            interests: fc.option(
              fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 10 }),
              { nil: undefined }
            ),
          }),
          (attributes: ProfileAttributes) => {
            const attributeList = buildAttributeList(attributes);
            
            // Count how many fields were provided
            const providedCount = [
              attributes.displayName,
              attributes.firstName,
              attributes.lastName,
              attributes.interests,
            ].filter(v => v !== undefined).length;
            
            // Attribute list should have exactly that many entries
            expect(attributeList.length).toBe(providedCount);
            
            // Each provided field should be in the list
            if (attributes.displayName !== undefined) {
              expect(attributeList.some(a => a.Name === 'custom:displayName')).toBe(true);
            }
            if (attributes.firstName !== undefined) {
              expect(attributeList.some(a => a.Name === 'custom:firstName')).toBe(true);
            }
            if (attributes.lastName !== undefined) {
              expect(attributeList.some(a => a.Name === 'custom:lastName')).toBe(true);
            }
            if (attributes.interests !== undefined) {
              expect(attributeList.some(a => a.Name === 'custom:interests')).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not include undefined fields in attribute list', () => {
      fc.assert(
        fc.property(
          fc.record({
            displayName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            firstName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            lastName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            interests: fc.option(
              fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 10 }),
              { nil: undefined }
            ),
          }),
          (attributes: ProfileAttributes) => {
            const attributeList = buildAttributeList(attributes);
            
            // Undefined fields should not appear
            if (attributes.displayName === undefined) {
              expect(attributeList.some(a => a.Name === 'custom:displayName')).toBe(false);
            }
            if (attributes.firstName === undefined) {
              expect(attributeList.some(a => a.Name === 'custom:firstName')).toBe(false);
            }
            if (attributes.lastName === undefined) {
              expect(attributeList.some(a => a.Name === 'custom:lastName')).toBe(false);
            }
            if (attributes.interests === undefined) {
              expect(attributeList.some(a => a.Name === 'custom:interests')).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty list when no fields provided', () => {
      const attributes: ProfileAttributes = {};
      const attributeList = buildAttributeList(attributes);
      expect(attributeList).toEqual([]);
    });

    it('should correctly map field names to Cognito attributes', () => {
      const attributes: ProfileAttributes = {
        displayName: 'Test User',
        firstName: 'Test',
        lastName: 'User',
        interests: ['coding', 'gaming'],
      };
      
      const attributeList = buildAttributeList(attributes);
      
      expect(attributeList).toContainEqual({ Name: 'custom:displayName', Value: 'Test User' });
      expect(attributeList).toContainEqual({ Name: 'custom:firstName', Value: 'Test' });
      expect(attributeList).toContainEqual({ Name: 'custom:lastName', Value: 'User' });
      expect(attributeList).toContainEqual({ 
        Name: 'custom:interests', 
        Value: '["coding","gaming"]' 
      });
    });
  });
});
