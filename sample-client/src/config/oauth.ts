/**
 * OAuth/OIDC configuration for the sample client
 */
export const oauthConfig = {
  // Cognito client ID
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
  
  // Cognito domain for OAuth endpoints
  cognitoDomain: import.meta.env.VITE_COGNITO_DOMAIN || '',
  
  // This app's callback URL
  redirectUri: import.meta.env.VITE_REDIRECT_URI || 'http://localhost:3001/callback',
  
  // OAuth scopes
  scopes: ['openid', 'email', 'profile'],

  // Client secret (optional). When set, token exchange is proxied through
  // the backend so the secret never reaches the browser.
  clientSecret: import.meta.env.VITE_CLIENT_SECRET || '',
};

/**
 * Whether this client is configured as a confidential client (has a secret).
 */
export function isConfidentialClient(): boolean {
  return oauthConfig.clientSecret.length > 0;
}

/**
 * Get the Cognito OAuth authorize URL
 */
export function getCognitoAuthorizeUrl(): string {
  return `https://${oauthConfig.cognitoDomain}/oauth2/authorize`;
}

/**
 * Get the Cognito OAuth token URL
 */
export function getCognitoTokenUrl(): string {
  return `https://${oauthConfig.cognitoDomain}/oauth2/token`;
}

/**
 * Get the Cognito logout URL
 */
export function getCognitoLogoutUrl(): string {
  return `https://${oauthConfig.cognitoDomain}/logout`;
}
