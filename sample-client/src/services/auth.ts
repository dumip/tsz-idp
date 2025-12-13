/**
 * Authentication service for the sample client
 * Implements OIDC Authorization Code flow with PKCE
 * 
 * Requirements: 1.1 (PKCE), 1.4 (Discovery), 10.4 (Public client PKCE enforcement)
 */
import { oauthConfig, getCognitoAuthorizeUrl, getCognitoTokenUrl, getCognitoLogoutUrl } from '../config/oauth';
import { generatePKCEPair, storePKCEVerifier, getStoredPKCEVerifier, clearPKCEVerifier } from '../utils/pkce';

/**
 * Token response from Cognito
 */
export interface TokenResponse {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}

/**
 * Decoded ID token claims
 */
export interface IdTokenClaims {
  sub: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  auth_time?: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  'custom:displayName'?: string;
  'custom:firstName'?: string;
  'custom:lastName'?: string;
  'custom:interests'?: string;
}

/**
 * User profile extracted from tokens
 */
export interface UserProfile {
  sub: string;
  email?: string;
  emailVerified?: boolean;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  interests?: string[];
}

/**
 * Authentication state stored in session
 */
export interface AuthState {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresAt: number;
  idTokenClaims: IdTokenClaims;
  userProfile: UserProfile;
}

const AUTH_STATE_KEY = 'auth_state';
const OAUTH_STATE_KEY = 'oauth_state';

/**
 * Generate a random state parameter for CSRF protection
 */
function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Decode a JWT token (without verification - verification happens server-side)
 */
function decodeJwt<T>(token: string): T {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  
  const payload = parts[1];
  // Add padding if needed
  const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
  const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(decoded);
}


/**
 * Extract user profile from ID token claims
 */
function extractUserProfile(claims: IdTokenClaims): UserProfile {
  let interests: string[] | undefined;
  if (claims['custom:interests']) {
    try {
      interests = JSON.parse(claims['custom:interests']);
    } catch {
      interests = undefined;
    }
  }

  return {
    sub: claims.sub,
    email: claims.email,
    emailVerified: claims.email_verified,
    displayName: claims['custom:displayName'] || claims.name,
    firstName: claims['custom:firstName'] || claims.given_name,
    lastName: claims['custom:lastName'] || claims.family_name,
    interests,
  };
}

/**
 * Initiate the OIDC login flow
 * Redirects to Cognito authorize endpoint with PKCE
 */
export async function initiateLogin(): Promise<void> {
  // Generate PKCE pair
  const { codeVerifier, codeChallenge } = await generatePKCEPair();
  storePKCEVerifier(codeVerifier);

  // Generate state for CSRF protection
  const state = generateState();
  sessionStorage.setItem(OAUTH_STATE_KEY, state);

  // Build authorization URL
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: oauthConfig.clientId,
    redirect_uri: oauthConfig.redirectUri,
    scope: oauthConfig.scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  const authorizeUrl = `${getCognitoAuthorizeUrl()}?${params.toString()}`;
  window.location.href = authorizeUrl;
}

/**
 * Handle the OAuth callback
 * Exchanges authorization code for tokens
 */
export async function handleCallback(code: string, state: string): Promise<AuthState> {
  // Verify state to prevent CSRF
  const storedState = sessionStorage.getItem(OAUTH_STATE_KEY);
  if (state !== storedState) {
    throw new Error('Invalid state parameter - possible CSRF attack');
  }
  sessionStorage.removeItem(OAUTH_STATE_KEY);

  // Get stored PKCE verifier
  const codeVerifier = getStoredPKCEVerifier();
  if (!codeVerifier) {
    throw new Error('Missing PKCE code verifier');
  }
  clearPKCEVerifier();

  // Exchange code for tokens
  const tokenResponse = await exchangeCodeForTokens(code, codeVerifier);
  
  // Decode ID token to get claims
  const idTokenClaims = decodeJwt<IdTokenClaims>(tokenResponse.id_token);
  
  // Calculate expiration time
  const expiresAt = Date.now() + (tokenResponse.expires_in * 1000);

  // Build auth state
  const authState: AuthState = {
    accessToken: tokenResponse.access_token,
    idToken: tokenResponse.id_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt,
    idTokenClaims,
    userProfile: extractUserProfile(idTokenClaims),
  };

  // Store auth state
  sessionStorage.setItem(AUTH_STATE_KEY, JSON.stringify(authState));

  return authState;
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: oauthConfig.clientId,
    code,
    redirect_uri: oauthConfig.redirectUri,
    code_verifier: codeVerifier,
  });

  const response = await fetch(getCognitoTokenUrl(), {
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

  return response.json();
}

/**
 * Get current authentication state
 */
export function getAuthState(): AuthState | null {
  const stored = sessionStorage.getItem(AUTH_STATE_KEY);
  if (!stored) return null;
  
  try {
    const authState = JSON.parse(stored) as AuthState;
    
    // Check if tokens are expired
    if (authState.expiresAt < Date.now()) {
      clearAuthState();
      return null;
    }
    
    return authState;
  } catch {
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const authState = getAuthState();
  return authState !== null;
}

/**
 * Clear authentication state
 */
export function clearAuthState(): void {
  sessionStorage.removeItem(AUTH_STATE_KEY);
}

/**
 * Logout the user
 * Clears local state and redirects to Cognito logout
 */
export function logout(): void {
  clearAuthState();
  
  // Redirect to Cognito logout endpoint
  const params = new URLSearchParams({
    client_id: oauthConfig.clientId,
    logout_uri: window.location.origin,
  });

  window.location.href = `${getCognitoLogoutUrl()}?${params.toString()}`;
}
