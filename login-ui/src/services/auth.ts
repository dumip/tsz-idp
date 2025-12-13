/**
 * Authentication service for TheSafeZone IDP
 * Uses amazon-cognito-identity-js for direct Cognito integration
 */
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js';
import type { ISignUpResult } from 'amazon-cognito-identity-js';
import { cognitoConfig, getCognitoOAuthUrl } from '../config/cognito';
import { getStoredOIDCParams, clearOIDCParams } from '../types/oauth';

// Cache for User Pool instances by client ID
const userPoolCache = new Map<string, CognitoUserPool>();

/**
 * Get or create a Cognito User Pool instance for a specific client ID
 * Uses the client_id from OIDC params if available, otherwise falls back to default
 * 
 * This ensures that when a client app (like sample-client) initiates login,
 * the authentication happens with that client's ID, not the Login UI's ID.
 */
const getUserPool = (clientId?: string): CognitoUserPool => {
  // Use provided clientId, or get from OIDC params, or fall back to default
  const oidcParams = getStoredOIDCParams();
  const effectiveClientId = clientId || oidcParams?.client_id || cognitoConfig.userPoolClientId;

  if (!cognitoConfig.userPoolId || !effectiveClientId) {
    throw new Error(
      'Cognito configuration is missing. Please set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID environment variables.'
    );
  }

  // Check cache first
  const cached = userPoolCache.get(effectiveClientId);
  if (cached) {
    return cached;
  }

  // Create new pool for this client ID
  const pool = new CognitoUserPool({
    UserPoolId: cognitoConfig.userPoolId,
    ClientId: effectiveClientId,
  });

  userPoolCache.set(effectiveClientId, pool);
  return pool;
};

/**
 * Authentication result containing tokens
 */
export interface AuthResult {
  accessToken: string;
  idToken: string;
  refreshToken: string;
}

/**
 * Authentication error with uniform message
 * Per Requirements 2.3: Error messages should not reveal whether email exists
 */
export interface AuthError {
  code: string;
  message: string;
}

/**
 * Map Cognito error codes to uniform user-friendly messages
 * This ensures we don't reveal whether an email exists (Requirement 2.3)
 */
const mapCognitoError = (error: Error & { code?: string }): AuthError => {
  const code = error.code || 'UnknownError';

  // Uniform error messages that don't reveal account existence
  const errorMessages: Record<string, string> = {
    NotAuthorizedException: 'Invalid email or password',
    UserNotFoundException: 'Invalid email or password', // Same message as wrong password
    UserNotConfirmedException: 'Please verify your email before signing in',
    PasswordResetRequiredException: 'Password reset required. Please reset your password.',
    TooManyRequestsException: 'Too many attempts. Please try again later.',
    LimitExceededException: 'Account temporarily locked. Please try again later.',
    InvalidParameterException: 'Invalid email or password format',
    NetworkError: 'Network error. Please check your connection.',
    UsernameExistsException: 'An account with this email already exists',
    InvalidPasswordException: 'Password does not meet requirements. Use at least 8 characters with uppercase, lowercase, numbers, and symbols.',
    CodeMismatchException: 'Invalid verification code. Please try again.',
    ExpiredCodeException: 'Verification code has expired. Please request a new one.',
  };

  return {
    code,
    message: errorMessages[code] || 'An error occurred. Please try again.',
  };
};

/**
 * Sign in with email and password
 * Implements Requirement 2.2: Authenticate user and issue tokens
 */
export const signIn = (email: string, password: string): Promise<AuthResult> => {
  return new Promise((resolve, reject) => {
    let pool: CognitoUserPool;
    try {
      pool = getUserPool();
    } catch (err) {
      reject({
        code: 'ConfigurationError',
        message: (err as Error).message,
      });
      return;
    }

    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: pool,
    });

    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session: CognitoUserSession) => {
        resolve({
          accessToken: session.getAccessToken().getJwtToken(),
          idToken: session.getIdToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken(),
        });
      },
      onFailure: (err: Error) => {
        reject(mapCognitoError(err as Error & { code?: string }));
      },
      // Handle MFA if configured
      mfaRequired: () => {
        reject({
          code: 'MFARequired',
          message: 'Multi-factor authentication required',
        });
      },
      newPasswordRequired: () => {
        reject({
          code: 'NewPasswordRequired',
          message: 'Password change required',
        });
      },
    });
  });
};

/**
 * Build Google OAuth URL for Cognito
 * Implements Requirement 3.1: Redirect to Google's OAuth2 authorization endpoint
 */
export const getGoogleOAuthUrl = (): string => {
  const oidcParams = getStoredOIDCParams();

  // Build the OAuth authorize URL with Google as identity provider
  const params = new URLSearchParams({
    identity_provider: 'Google',
    response_type: oidcParams?.response_type || 'code',
    client_id: oidcParams?.client_id || cognitoConfig.userPoolClientId,
    redirect_uri: oidcParams?.redirect_uri || `${window.location.origin}/oauth2/callback`,
    scope: oidcParams?.scope || cognitoConfig.oauth.scope.join(' '),
  });

  // Include PKCE parameters if present
  if (oidcParams?.code_challenge) {
    params.set('code_challenge', oidcParams.code_challenge);
    params.set('code_challenge_method', oidcParams.code_challenge_method || 'S256');
  }

  // Include state for CSRF protection
  if (oidcParams?.state) {
    params.set('state', oidcParams.state);
  }

  return getCognitoOAuthUrl(`/oauth2/authorize?${params.toString()}`);
};

/**
 * Complete the OIDC flow by redirecting back to the client
 * Called after successful authentication
 * 
 * If OIDC params exist (user came from a client app), redirects to Cognito to complete the flow.
 * If no OIDC params (direct navigation to login UI), redirects to a default success page.
 */
export const completeOIDCFlow = (_tokens: AuthResult): void => {
  const oidcParams = getStoredOIDCParams();

  if (oidcParams) {
    // For OIDC flow, we need to redirect back to Cognito to complete the authorization
    // Cognito will then redirect to the client's redirect_uri with the authorization code
    const params = new URLSearchParams({
      response_type: oidcParams.response_type,
      client_id: oidcParams.client_id,
      redirect_uri: oidcParams.redirect_uri,
      scope: oidcParams.scope,
    });

    if (oidcParams.state) {
      params.set('state', oidcParams.state);
    }
    if (oidcParams.code_challenge) {
      params.set('code_challenge', oidcParams.code_challenge);
      params.set('code_challenge_method', oidcParams.code_challenge_method || 'S256');
    }

    clearOIDCParams();

    // Redirect to Cognito authorize endpoint to complete the flow
    window.location.href = getCognitoOAuthUrl(`/oauth2/authorize?${params.toString()}`);
  } else {
    // No OIDC params - user navigated directly to login UI
    // Redirect to login page with success message
    window.location.href = '/login?authenticated=true';
  }
};

/**
 * Get the current authenticated user
 */
export const getCurrentUser = (): CognitoUser | null => {
  try {
    return getUserPool().getCurrentUser();
  } catch {
    return null;
  }
};

/**
 * Sign out the current user
 */
export const signOut = (): void => {
  const user = getCurrentUser();
  if (user) {
    user.signOut();
  }
};

/**
 * Sign up result containing user information
 */
export interface SignUpResult {
  userSub: string;
  userConfirmed: boolean;
}

/**
 * Sign up a new user with email and password
 * Implements Requirement 2.1: Create a new user account and send a verification email
 */
export const signUp = (email: string, password: string): Promise<SignUpResult> => {
  return new Promise((resolve, reject) => {
    let pool: CognitoUserPool;
    try {
      pool = getUserPool();
    } catch (err) {
      reject({
        code: 'ConfigurationError',
        message: (err as Error).message,
      });
      return;
    }

    const attributeList: CognitoUserAttribute[] = [
      new CognitoUserAttribute({
        Name: 'email',
        Value: email,
      }),
    ];

    pool.signUp(
      email,
      password,
      attributeList,
      [],
      (err: Error | undefined, result: ISignUpResult | undefined) => {
        if (err) {
          reject(mapCognitoError(err as Error & { code?: string }));
          return;
        }
        if (result) {
          resolve({
            userSub: result.userSub,
            userConfirmed: result.userConfirmed,
          });
        }
      }
    );
  });
};

/**
 * Confirm sign up with verification code
 * Implements Requirement 2.1: Verify email after registration
 */
export const confirmSignUp = (email: string, code: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    let pool: CognitoUserPool;
    try {
      pool = getUserPool();
    } catch (err) {
      reject({
        code: 'ConfigurationError',
        message: (err as Error).message,
      });
      return;
    }

    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: pool,
    });

    cognitoUser.confirmRegistration(code, true, (err: Error | undefined) => {
      if (err) {
        reject(mapCognitoError(err as Error & { code?: string }));
        return;
      }
      resolve();
    });
  });
};

/**
 * Resend confirmation code to user's email
 */
export const resendConfirmationCode = (email: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    let pool: CognitoUserPool;
    try {
      pool = getUserPool();
    } catch (err) {
      reject({
        code: 'ConfigurationError',
        message: (err as Error).message,
      });
      return;
    }

    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: pool,
    });

    cognitoUser.resendConfirmationCode((err: Error | undefined) => {
      if (err) {
        reject(mapCognitoError(err as Error & { code?: string }));
        return;
      }
      resolve();
    });
  });
};

/**
 * Initiate forgot password flow
 * Implements Requirement 2.4: Send a reset link to the registered email address
 */
export const forgotPassword = (email: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    let pool: CognitoUserPool;
    try {
      pool = getUserPool();
    } catch (err) {
      reject({
        code: 'ConfigurationError',
        message: (err as Error).message,
      });
      return;
    }

    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: pool,
    });

    cognitoUser.forgotPassword({
      onSuccess: () => {
        resolve();
      },
      onFailure: (err: Error) => {
        reject(mapCognitoError(err as Error & { code?: string }));
      },
    });
  });
};

/**
 * Complete forgot password flow with verification code and new password
 * Implements Requirement 2.4: Complete password reset
 */
export const forgotPasswordSubmit = (
  email: string,
  code: string,
  newPassword: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    let pool: CognitoUserPool;
    try {
      pool = getUserPool();
    } catch (err) {
      reject({
        code: 'ConfigurationError',
        message: (err as Error).message,
      });
      return;
    }

    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: pool,
    });

    cognitoUser.confirmPassword(code, newPassword, {
      onSuccess: () => {
        resolve();
      },
      onFailure: (err: Error) => {
        reject(mapCognitoError(err as Error & { code?: string }));
      },
    });
  });
};
