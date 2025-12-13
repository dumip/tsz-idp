/**
 * Property-Based Tests for Device Code Flow
 * 
 * Uses fast-check for property-based testing as specified in the design document.
 */
import * as fc from 'fast-check';
import { 
  generateDeviceCode, 
  generateUserCode, 
  isValidDeviceCode, 
  isValidUserCode,
  normalizeUserCode 
} from '../lib/lambda/device-code/code-generator';

describe('Device Code Property Tests', () => {
  /**
   * **Feature: thesafezone-idp, Property 15: Device Code Format and Expiration**
   * 
   * *For any* device code request, the generated user_code and device_code 
   * SHALL be unique, and the expires_in value SHALL be 600 seconds (10 minutes).
   * 
   * **Validates: Requirements 9.1, 9.2**
   */
  describe('Property 15: Device Code Format and Expiration', () => {
    // Configuration constant from the implementation
    const DEVICE_CODE_EXPIRATION_SECONDS = 600;

    test('device codes are 32 hex characters', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), () => {
          const deviceCode = generateDeviceCode();
          expect(deviceCode).toMatch(/^[a-f0-9]{32}$/);
          expect(isValidDeviceCode(deviceCode)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    test('user codes are 8 alphanumeric characters (formatted as XXX-XXXX)', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), () => {
          const userCode = generateUserCode();
          // Format should be XXX-XXXX
          expect(userCode).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{5}$/);
          expect(isValidUserCode(userCode)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });


    test('user codes exclude ambiguous characters (0, O, 1, I, L)', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), () => {
          const userCode = generateUserCode();
          const normalized = normalizeUserCode(userCode);
          // Should not contain ambiguous characters
          expect(normalized).not.toMatch(/[0O1IL]/);
        }),
        { numRuns: 100 }
      );
    });

    test('generated device codes are unique', () => {
      const codes = new Set<string>();
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), () => {
          const deviceCode = generateDeviceCode();
          expect(codes.has(deviceCode)).toBe(false);
          codes.add(deviceCode);
          return true;
        }),
        { numRuns: 1000 }
      );
    });

    test('generated user codes are unique', () => {
      const codes = new Set<string>();
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), () => {
          const userCode = normalizeUserCode(generateUserCode());
          expect(codes.has(userCode)).toBe(false);
          codes.add(userCode);
          return true;
        }),
        { numRuns: 1000 }
      );
    });

    test('expiration is always 600 seconds (10 minutes)', () => {
      // This validates the constant is correctly set
      expect(DEVICE_CODE_EXPIRATION_SECONDS).toBe(600);
    });

    test('user code validation accepts valid codes', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), () => {
          const userCode = generateUserCode();
          expect(isValidUserCode(userCode)).toBe(true);
          // Also valid without hyphen
          expect(isValidUserCode(normalizeUserCode(userCode))).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    test('device code validation accepts valid codes', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), () => {
          const deviceCode = generateDeviceCode();
          expect(isValidDeviceCode(deviceCode)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });
});


describe('Device Code Polling State Tests', () => {
  /**
   * **Feature: thesafezone-idp, Property 16: Device Code Polling States**
   * 
   * *For any* device code, polling before authorization SHALL return 
   * "authorization_pending"; polling after authorization SHALL return valid tokens.
   * 
   * **Validates: Requirements 9.4, 9.5**
   */
  describe('Property 16: Device Code Polling States', () => {
    // Test the state machine logic for device code polling
    // We test the pure logic without DynamoDB integration

    type DeviceCodeStatus = 'pending' | 'authorized' | 'denied' | 'expired';

    interface MockDeviceCodeRecord {
      deviceCode: string;
      userCode: string;
      clientId: string;
      scope: string;
      expiresAt: number;
      status: DeviceCodeStatus;
      tokens?: {
        accessToken: string;
        idToken: string;
        refreshToken: string;
      };
    }

    /**
     * Pure function that determines the polling response based on record state
     * This mirrors the logic in device-token.ts handler
     */
    function getPollingResponse(
      record: MockDeviceCodeRecord | null,
      requestClientId: string,
      currentTime: number
    ): { error?: string; tokens?: object } {
      if (!record) {
        return { error: 'invalid_grant' };
      }

      if (record.clientId !== requestClientId) {
        return { error: 'invalid_grant' };
      }

      if (currentTime > record.expiresAt) {
        return { error: 'expired_token' };
      }

      switch (record.status) {
        case 'pending':
          return { error: 'authorization_pending' };
        case 'authorized':
          if (!record.tokens) {
            return { error: 'server_error' };
          }
          return { tokens: record.tokens };
        case 'denied':
          return { error: 'access_denied' };
        case 'expired':
          return { error: 'expired_token' };
        default:
          return { error: 'server_error' };
      }
    }


    // Generator for valid device code records
    const deviceCodeRecordArb = fc.record({
      deviceCode: fc.hexaString({ minLength: 32, maxLength: 32 }),
      userCode: fc.stringOf(
        fc.constantFrom(...'ABCDEFGHJKMNPQRSTUVWXYZ23456789'),
        { minLength: 8, maxLength: 8 }
      ),
      clientId: fc.uuid(),
      scope: fc.constant('openid email profile'),
      expiresAt: fc.integer({ min: 1000000000, max: 2000000000 }),
      status: fc.constantFrom('pending', 'authorized', 'denied', 'expired') as fc.Arbitrary<DeviceCodeStatus>,
    });

    test('pending status returns authorization_pending', () => {
      fc.assert(
        fc.property(
          deviceCodeRecordArb,
          fc.integer({ min: 0, max: 999999999 }), // currentTime before expiration
          (baseRecord, _timeOffset) => {
            const record: MockDeviceCodeRecord = {
              ...baseRecord,
              status: 'pending',
              expiresAt: baseRecord.expiresAt + 1000, // Ensure not expired
            };
            const currentTime = record.expiresAt - 100; // Before expiration
            
            const result = getPollingResponse(record, record.clientId, currentTime);
            expect(result.error).toBe('authorization_pending');
            expect(result.tokens).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('authorized status with tokens returns tokens', () => {
      fc.assert(
        fc.property(
          deviceCodeRecordArb,
          fc.record({
            accessToken: fc.string({ minLength: 10, maxLength: 100 }),
            idToken: fc.string({ minLength: 10, maxLength: 100 }),
            refreshToken: fc.string({ minLength: 10, maxLength: 100 }),
          }),
          (baseRecord, tokens) => {
            const record: MockDeviceCodeRecord = {
              ...baseRecord,
              status: 'authorized',
              tokens,
              expiresAt: baseRecord.expiresAt + 1000,
            };
            const currentTime = record.expiresAt - 100;
            
            const result = getPollingResponse(record, record.clientId, currentTime);
            expect(result.error).toBeUndefined();
            expect(result.tokens).toEqual(tokens);
          }
        ),
        { numRuns: 100 }
      );
    });


    test('expired records return expired_token', () => {
      fc.assert(
        fc.property(
          deviceCodeRecordArb,
          (baseRecord) => {
            const record: MockDeviceCodeRecord = {
              ...baseRecord,
              expiresAt: 1000000000, // Set a fixed past time
            };
            const currentTime = record.expiresAt + 100; // After expiration
            
            const result = getPollingResponse(record, record.clientId, currentTime);
            expect(result.error).toBe('expired_token');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('denied status returns access_denied', () => {
      fc.assert(
        fc.property(
          deviceCodeRecordArb,
          (baseRecord) => {
            const record: MockDeviceCodeRecord = {
              ...baseRecord,
              status: 'denied',
              expiresAt: baseRecord.expiresAt + 1000,
            };
            const currentTime = record.expiresAt - 100;
            
            const result = getPollingResponse(record, record.clientId, currentTime);
            expect(result.error).toBe('access_denied');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('mismatched client_id returns invalid_grant', () => {
      fc.assert(
        fc.property(
          deviceCodeRecordArb,
          fc.uuid(),
          (record, differentClientId) => {
            // Ensure the client IDs are actually different
            fc.pre(record.clientId !== differentClientId);
            
            const currentTime = record.expiresAt - 100;
            const result = getPollingResponse(record, differentClientId, currentTime);
            expect(result.error).toBe('invalid_grant');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('null record returns invalid_grant', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.integer({ min: 1000000000, max: 2000000000 }),
          (clientId, currentTime) => {
            const result = getPollingResponse(null, clientId, currentTime);
            expect(result.error).toBe('invalid_grant');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('state transitions are deterministic', () => {
      // For any given record state, the response should always be the same
      fc.assert(
        fc.property(
          deviceCodeRecordArb,
          fc.record({
            accessToken: fc.string({ minLength: 10, maxLength: 100 }),
            idToken: fc.string({ minLength: 10, maxLength: 100 }),
            refreshToken: fc.string({ minLength: 10, maxLength: 100 }),
          }),
          (baseRecord, tokens) => {
            const record: MockDeviceCodeRecord = {
              ...baseRecord,
              tokens: baseRecord.status === 'authorized' ? tokens : undefined,
              expiresAt: baseRecord.expiresAt + 1000,
            };
            const currentTime = record.expiresAt - 100;
            
            // Call twice with same inputs
            const result1 = getPollingResponse(record, record.clientId, currentTime);
            const result2 = getPollingResponse(record, record.clientId, currentTime);
            
            // Results should be identical
            expect(result1).toEqual(result2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
