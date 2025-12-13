/**
 * Device Code Flow Types (RFC 8628)
 * 
 * These types define the data structures for the Device Code Flow
 * implementation for VR client authentication.
 */

/**
 * Status of a device code authorization request
 */
export type DeviceCodeStatus = 'pending' | 'authorized' | 'denied' | 'expired';

/**
 * Device Code record stored in DynamoDB
 */
export interface DeviceCodeRecord {
  deviceCode: string;           // Partition key - unique device code
  userCode: string;             // User-facing code for entry on secondary device
  clientId: string;             // Client application ID
  scope: string;                // Requested OAuth scopes
  expiresAt: number;            // Unix timestamp when code expires
  interval: number;             // Polling interval in seconds
  status: DeviceCodeStatus;     // Current authorization status
  userId?: string;              // Set when authorized - Cognito user sub
  tokens?: {                    // Set when authorized
    accessToken: string;
    idToken: string;
    refreshToken: string;
  };
  ttl: number;                  // DynamoDB TTL attribute
  createdAt: number;            // Unix timestamp of creation
}

/**
 * Request body for POST /device/code
 */
export interface DeviceCodeRequest {
  client_id: string;
  scope?: string;
}

/**
 * Response body for POST /device/code (RFC 8628 Section 3.2)
 */
export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}
