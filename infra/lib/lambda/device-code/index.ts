import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handleDeviceCodeRequest } from './handlers/device-code';
import { handleDeviceTokenRequest } from './handlers/device-token';
import { handleDeviceAuthorizeRequest } from './handlers/device-authorize';

/**
 * Main Lambda handler for Device Code Flow endpoints
 * 
 * Routes:
 * - POST /device/code - Generate device code and user code
 * - POST /device/token - Poll for tokens (VR client)
 * - POST /device/authorize - User authorizes device (after login)
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  console.log(`Received ${method} ${path}`);

  // Route to appropriate handler
  if (method === 'POST' && path === '/device/code') {
    return handleDeviceCodeRequest(event);
  }

  if (method === 'POST' && path === '/device/token') {
    return handleDeviceTokenRequest(event);
  }

  if (method === 'POST' && path === '/device/authorize') {
    return handleDeviceAuthorizeRequest(event);
  }

  return {
    statusCode: 404,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      error: 'not_found',
      error_description: `Unknown endpoint: ${method} ${path}`,
    }),
  };
}
