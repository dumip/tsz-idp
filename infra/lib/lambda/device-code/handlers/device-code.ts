import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { generateDeviceCode, generateUserCode, normalizeUserCode } from '../code-generator';
import { storeDeviceCode } from '../dynamodb-client';
import { DeviceCodeRequest, DeviceCodeResponse, DeviceCodeRecord } from '../types';

// Configuration
const DEVICE_CODE_EXPIRATION_SECONDS = 600; // 10 minutes per RFC 8628
const POLLING_INTERVAL_SECONDS = 5;
const VERIFICATION_URI = process.env.VERIFICATION_URI || 'https://thesafezone.eu/activate';

/**
 * POST /device/code handler
 * 
 * Implements RFC 8628 Section 3.1 - Device Authorization Request
 * 
 * Requirements: 9.1, 9.2
 * - Generate unique device_code and user_code
 * - Store in DynamoDB with 10-minute expiration
 * - Return verification_uri and polling interval
 */
export async function handleDeviceCodeRequest(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Parse and validate request body
    if (!event.body) {
      return errorResponse(400, 'invalid_request', 'Request body is required');
    }

    let request: DeviceCodeRequest;
    try {
      request = JSON.parse(event.body);
    } catch {
      return errorResponse(400, 'invalid_request', 'Invalid JSON in request body');
    }

    // Validate client_id
    if (!request.client_id) {
      return errorResponse(400, 'invalid_request', 'client_id is required');
    }

    // Generate codes
    const deviceCode = generateDeviceCode();
    const userCodeFormatted = generateUserCode(); // e.g., "ABC-DEFGH"
    const userCodeNormalized = normalizeUserCode(userCodeFormatted); // e.g., "ABCDEFGH"
    const scope = request.scope || 'openid email profile';

    // Calculate timestamps
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + DEVICE_CODE_EXPIRATION_SECONDS;
    // TTL should be slightly longer than expiration to allow for clock skew
    const ttl = expiresAt + 60;

    // Create record - store normalized user code for consistent lookups
    const record: DeviceCodeRecord = {
      deviceCode,
      userCode: userCodeNormalized,
      clientId: request.client_id,
      scope,
      expiresAt,
      interval: POLLING_INTERVAL_SECONDS,
      status: 'pending',
      ttl,
      createdAt: now,
    };

    // Store in DynamoDB
    await storeDeviceCode(record);

    // Build response per RFC 8628 Section 3.2
    // Return formatted user code for display (with hyphen for readability)
    const response: DeviceCodeResponse = {
      device_code: deviceCode,
      user_code: userCodeFormatted,
      verification_uri: VERIFICATION_URI,
      verification_uri_complete: `${VERIFICATION_URI}?user_code=${encodeURIComponent(userCodeFormatted)}`,
      expires_in: DEVICE_CODE_EXPIRATION_SECONDS,
      interval: POLLING_INTERVAL_SECONDS,
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error in device code request:', error);
    return errorResponse(500, 'server_error', 'Internal server error');
  }
}

/**
 * Creates an error response per RFC 8628
 */
function errorResponse(
  statusCode: number,
  error: string,
  errorDescription: string
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify({
      error,
      error_description: errorDescription,
    }),
  };
}
