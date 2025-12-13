import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { getDeviceCodeByUserCode, updateDeviceCodeStatus } from '../dynamodb-client';
import { isValidUserCode, normalizeUserCode } from '../code-generator';

/**
 * Request body for POST /device/authorize
 */
interface DeviceAuthorizeRequest {
  user_code: string;
  access_token: string;
  id_token: string;
  refresh_token: string;
}

// Cognito configuration from environment
const USER_POOL_ID = process.env.USER_POOL_ID || '';
const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID || '';

// Create JWT verifier for access tokens (lazy initialization)
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getVerifier() {
  if (!verifier && USER_POOL_ID && USER_POOL_CLIENT_ID) {
    verifier = CognitoJwtVerifier.create({
      userPoolId: USER_POOL_ID,
      tokenUse: 'access',
      clientId: USER_POOL_CLIENT_ID,
    });
  }
  return verifier;
}

/**
 * POST /device/authorize handler
 * 
 * Called by the Login UI after user authenticates on secondary device.
 * Associates the user's tokens with the device code.
 * 
 * Requirements: 9.3, 9.4
 * - Validate user authentication via access token
 * - Store tokens in DynamoDB record
 * - Update status to authorized
 */
export async function handleDeviceAuthorizeRequest(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Parse and validate request body
    if (!event.body) {
      return errorResponse(400, 'invalid_request', 'Request body is required');
    }

    let request: DeviceAuthorizeRequest;
    try {
      request = JSON.parse(event.body);
    } catch {
      return errorResponse(400, 'invalid_request', 'Invalid JSON in request body');
    }

    // Validate user_code
    if (!request.user_code || !isValidUserCode(request.user_code)) {
      return errorResponse(400, 'invalid_request', 'Invalid user_code');
    }

    // Validate tokens are provided
    if (!request.access_token) {
      return errorResponse(400, 'invalid_request', 'access_token is required');
    }
    if (!request.id_token) {
      return errorResponse(400, 'invalid_request', 'id_token is required');
    }
    if (!request.refresh_token) {
      return errorResponse(400, 'invalid_request', 'refresh_token is required');
    }

    // Verify the access token with Cognito
    const jwtVerifier = getVerifier();
    if (!jwtVerifier) {
      console.error('JWT verifier not configured - missing USER_POOL_ID or USER_POOL_CLIENT_ID');
      return errorResponse(500, 'server_error', 'Server configuration error');
    }

    let userId: string;
    try {
      const payload = await jwtVerifier.verify(request.access_token);
      userId = payload.sub;
    } catch (error) {
      console.error('Token verification failed:', error);
      return errorResponse(401, 'invalid_token', 'Access token is invalid or expired');
    }

    // Normalize user code (remove hyphens, uppercase)
    const normalizedUserCode = normalizeUserCode(request.user_code);

    // Look up device code record by user code
    const record = await getDeviceCodeByUserCode(normalizedUserCode);

    if (!record) {
      return errorResponse(400, 'invalid_grant', 'User code not found');
    }

    // Check if expired
    const now = Math.floor(Date.now() / 1000);
    if (now > record.expiresAt) {
      return errorResponse(400, 'expired_token', 'User code has expired');
    }

    // Check if already authorized or denied
    if (record.status !== 'pending') {
      return errorResponse(400, 'invalid_grant', 
        `Device code is already ${record.status}`);
    }

    // Update the record with tokens and authorized status
    await updateDeviceCodeStatus(
      record.deviceCode,
      'authorized',
      userId,
      {
        accessToken: request.access_token,
        idToken: request.id_token,
        refreshToken: request.refresh_token,
      }
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({
        success: true,
        message: 'Device authorized successfully',
      }),
    };
  } catch (error) {
    console.error('Error in device authorize request:', error);
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
