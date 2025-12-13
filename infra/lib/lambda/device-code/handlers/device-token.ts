import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDeviceCodeByDeviceCode, deleteDeviceCode } from '../dynamodb-client';
import { isValidDeviceCode } from '../code-generator';

/**
 * Request body for POST /device/token
 */
interface DeviceTokenRequest {
  grant_type: string;
  device_code: string;
  client_id: string;
}

/**
 * POST /device/token handler
 * 
 * Implements RFC 8628 Section 3.4 - Device Access Token Request
 * VR client polls this endpoint to check if user has authorized.
 * 
 * Requirements: 9.4, 9.5
 * - Return authorization_pending for pending codes
 * - Return tokens for authorized codes
 * - Return expired_token for expired codes
 */
export async function handleDeviceTokenRequest(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Parse and validate request body
    if (!event.body) {
      return errorResponse(400, 'invalid_request', 'Request body is required');
    }

    let request: DeviceTokenRequest;
    try {
      request = JSON.parse(event.body);
    } catch {
      return errorResponse(400, 'invalid_request', 'Invalid JSON in request body');
    }

    // Validate grant_type
    if (request.grant_type !== 'urn:ietf:params:oauth:grant-type:device_code') {
      return errorResponse(400, 'unsupported_grant_type', 
        'grant_type must be urn:ietf:params:oauth:grant-type:device_code');
    }

    // Validate device_code
    if (!request.device_code || !isValidDeviceCode(request.device_code)) {
      return errorResponse(400, 'invalid_request', 'Invalid device_code');
    }

    // Validate client_id
    if (!request.client_id) {
      return errorResponse(400, 'invalid_request', 'client_id is required');
    }

    // Look up device code record
    const record = await getDeviceCodeByDeviceCode(request.device_code);

    if (!record) {
      return errorResponse(400, 'invalid_grant', 'Device code not found');
    }

    // Verify client_id matches
    if (record.clientId !== request.client_id) {
      return errorResponse(400, 'invalid_grant', 'client_id mismatch');
    }

    // Check if expired
    const now = Math.floor(Date.now() / 1000);
    if (now > record.expiresAt) {
      // Clean up expired record
      await deleteDeviceCode(record.deviceCode);
      return errorResponse(400, 'expired_token', 'Device code has expired');
    }

    // Check status
    switch (record.status) {
      case 'pending':
        // User hasn't authorized yet - return authorization_pending
        return errorResponse(400, 'authorization_pending', 
          'Authorization pending. Continue polling.');

      case 'authorized':
        // User has authorized - return tokens
        if (!record.tokens) {
          return errorResponse(500, 'server_error', 'Tokens not available');
        }
        
        // Delete the record after successful token retrieval
        await deleteDeviceCode(record.deviceCode);
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
          body: JSON.stringify({
            access_token: record.tokens.accessToken,
            id_token: record.tokens.idToken,
            refresh_token: record.tokens.refreshToken,
            token_type: 'Bearer',
            expires_in: 3600, // 1 hour
          }),
        };

      case 'denied':
        // User denied authorization
        await deleteDeviceCode(record.deviceCode);
        return errorResponse(400, 'access_denied', 'User denied authorization');

      case 'expired':
        // Explicitly marked as expired
        await deleteDeviceCode(record.deviceCode);
        return errorResponse(400, 'expired_token', 'Device code has expired');

      default:
        return errorResponse(500, 'server_error', 'Unknown device code status');
    }
  } catch (error) {
    console.error('Error in device token request:', error);
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
