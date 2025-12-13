/**
 * OIDC parameters received from Cognito redirect
 * These are passed when Cognito redirects to our custom login UI
 */
export interface OIDCParams {
  client_id: string;
  redirect_uri: string;
  response_type: string;
  scope: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  nonce?: string;
  identity_provider?: string;
}

/**
 * Parse OIDC parameters from URL search params
 */
export const parseOIDCParams = (searchParams: URLSearchParams): OIDCParams | null => {
  const client_id = searchParams.get('client_id');
  const redirect_uri = searchParams.get('redirect_uri');
  const response_type = searchParams.get('response_type');
  const scope = searchParams.get('scope');

  // Required parameters
  if (!client_id || !redirect_uri || !response_type || !scope) {
    return null;
  }

  return {
    client_id,
    redirect_uri,
    response_type,
    scope,
    state: searchParams.get('state') || undefined,
    code_challenge: searchParams.get('code_challenge') || undefined,
    code_challenge_method: searchParams.get('code_challenge_method') || undefined,
    nonce: searchParams.get('nonce') || undefined,
    identity_provider: searchParams.get('identity_provider') || undefined,
  };
};

/**
 * Store OIDC params in session storage for use after authentication
 */
export const storeOIDCParams = (params: OIDCParams): void => {
  sessionStorage.setItem('oidc_params', JSON.stringify(params));
};

/**
 * Retrieve stored OIDC params from session storage
 */
export const getStoredOIDCParams = (): OIDCParams | null => {
  const stored = sessionStorage.getItem('oidc_params');
  if (!stored) return null;
  try {
    return JSON.parse(stored) as OIDCParams;
  } catch {
    return null;
  }
};

/**
 * Clear stored OIDC params
 */
export const clearOIDCParams = (): void => {
  sessionStorage.removeItem('oidc_params');
};
