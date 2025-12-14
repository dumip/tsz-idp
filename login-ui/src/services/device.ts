/**
 * Device Code Flow service for VR authentication
 * Implements RFC 8628 Device Authorization Grant
 * 
 * Requirements: 9.3
 */
import { cognitoConfig, getCognitoOAuthUrl } from '../config/cognito';

/**
 * Device code validation response
 */
export interface DeviceCodeValidationResult {
  valid: boolean;
  error?: string;
  errorDescription?: string;
}

/**
 * Device authorization response
 */
export interface DeviceAuthorizeResult {
  success: boolean;
  message?: string;
  error?: string;
  errorDescription?: string;
}

/**
 * Normalize user code by removing hyphens and converting to uppercase
 */
export const normalizeUserCode = (code: string): string => {
  return code.replace(/-/g, '').toUpperCase().trim();
};

/**
 * Format user code for display (add hyphen in middle)
 */
export const formatUserCode = (code: string): string => {
  const normalized = normalizeUserCode(code);
  if (normalized.length === 8) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
  }
  return normalized;
};

/**
 * Validate user code format
 * User codes are 8 characters from the set: ABCDEFGHJKLMNPQRSTUVWXYZ23456789
 */
export const isValidUserCodeFormat = (code: string): boolean => {
  const normalized = normalizeUserCode(code);
  if (normalized.length !== 8) {
    return false;
  }
  // Valid characters: A-Z (excluding I, O) and 2-9 (excluding 0, 1)
  const validChars = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/;
  return validChars.test(normalized);
};

/**
 * Store device flow state in session storage
 */
export interface DeviceFlowState {
  userCode: string;
  timestamp: number;
}

export const storeDeviceFlowState = (userCode: string): void => {
  const state: DeviceFlowState = {
    userCode: normalizeUserCode(userCode),
    timestamp: Date.now(),
  };
  sessionStorage.setItem('device_flow_state', JSON.stringify(state));
};

export const getDeviceFlowState = (): DeviceFlowState | null => {
  const stored = sessionStorage.getItem('device_flow_state');
  if (!stored) return null;
  try {
    return JSON.parse(stored) as DeviceFlowState;
  } catch {
    return null;
  }
};

export const clearDeviceFlowState = (): void => {
  sessionStorage.removeItem('device_flow_state');
};

/**
 * Build Cognito OAuth URL for device activation flow
 * This redirects to Cognito Managed Login for authentication
 */
export const getDeviceActivationOAuthUrl = (userCode: string): string => {
  // Generate a random state that includes the user code for the callback
  const state = btoa(JSON.stringify({
    type: 'device_activation',
    userCode: normalizeUserCode(userCode),
    nonce: crypto.randomUUID(),
  }));

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cognitoConfig.userPoolClientId,
    redirect_uri: `${window.location.origin}/activate`,
    scope: 'openid email profile',
    state,
  });

  return getCognitoOAuthUrl(`/oauth2/authorize?${params.toString()}`);
};

/**
 * Exchange authorization code for tokens with Cognito
 */
export const exchangeCodeForTokens = async (
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; idToken: string; refreshToken: string }> => {
  const tokenUrl = getCognitoOAuthUrl('/oauth2/token');
  
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: cognitoConfig.userPoolClientId,
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || error.error || 'Token exchange failed');
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    idToken: data.id_token,
    refreshToken: data.refresh_token,
  };
};

/**
 * Authorize device with the Device Code API
 * Called after user authenticates to link their tokens to the device code
 * 
 * Requirements: 9.3, 9.4
 */
export const authorizeDevice = async (
  userCode: string,
  accessToken: string,
  idToken: string,
  refreshToken: string
): Promise<DeviceAuthorizeResult> => {
  const apiEndpoint = cognitoConfig.apiEndpoint;
  
  if (!apiEndpoint || apiEndpoint === 'https://your-api-id.execute-api.region.amazonaws.com') {
    return {
      success: false,
      error: 'configuration_error',
      errorDescription: 'API endpoint not configured. Please set VITE_API_ENDPOINT.',
    };
  }

  try {
    const response = await fetch(`${apiEndpoint}/device/authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_code: normalizeUserCode(userCode),
        access_token: accessToken,
        id_token: idToken,
        refresh_token: refreshToken,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'unknown_error',
        errorDescription: data.error_description || 'Failed to authorize device',
      };
    }

    return {
      success: true,
      message: data.message || 'Device authorized successfully',
    };
  } catch (error) {
    console.error('Device authorization error:', error);
    return {
      success: false,
      error: 'network_error',
      errorDescription: 'Failed to connect to authorization server',
    };
  }
};

/**
 * Parse the OAuth state parameter to extract device flow info
 */
export interface DeviceActivationState {
  type: 'device_activation';
  userCode: string;
  nonce: string;
}

export const parseDeviceActivationState = (state: string): DeviceActivationState | null => {
  try {
    const decoded = JSON.parse(atob(state));
    if (decoded.type === 'device_activation' && decoded.userCode) {
      return decoded as DeviceActivationState;
    }
    return null;
  } catch {
    return null;
  }
};
