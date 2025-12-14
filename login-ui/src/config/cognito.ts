/**
 * Cognito configuration for TheSafeZone IDP
 * These values should be set via environment variables in production
 */
export const cognitoConfig = {
  // User Pool configuration
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
  userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
  
  // Cognito domain for OAuth endpoints
  cognitoDomain: import.meta.env.VITE_COGNITO_DOMAIN || '',
  
  // API Gateway endpoint for Device Code flow
  apiEndpoint: import.meta.env.VITE_API_ENDPOINT || '',
  
  // OAuth configuration
  oauth: {
    // aws.cognito.signin.user.admin is required for UpdateUserAttributes API
    scope: ['openid', 'email', 'profile', 'aws.cognito.signin.user.admin'],
    responseType: 'code',
  },
};

/**
 * Get the full Cognito OAuth URL
 */
export const getCognitoOAuthUrl = (path: string): string => {
  return `https://${cognitoConfig.cognitoDomain}${path}`;
};
