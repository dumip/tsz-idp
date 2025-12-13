# TheSafeZone Sample Client

A sample client application demonstrating OIDC login with TheSafeZone IDP using OAuth2 Authorization Code flow with PKCE.

## Features

- **PKCE Authentication**: Implements RFC 7636 Proof Key for Code Exchange
- **User Profile Display**: Shows user information from ID token claims
- **Token Information**: Displays access token expiry, ID token claims, and refresh token status
- **Logout**: Clears local state and redirects to Cognito logout
- **TheSafeZone Styling**: Consistent visual identity with the Login UI

## Setup

1. Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

2. Fill in your Cognito configuration:

```env
VITE_COGNITO_CLIENT_ID=your-client-id
VITE_COGNITO_DOMAIN=your-domain.auth.region.amazoncognito.com
VITE_LOGIN_UI_URL=http://localhost:3000
VITE_REDIRECT_URI=http://localhost:3001/callback
```

3. Install dependencies:

```bash
npm install
```

4. Start the development server:

```bash
npm run dev
```

The app runs on port 3001 by default (different from the Login UI on port 3000).

## OIDC Flow

1. User clicks "Sign In with TheSafeZone"
2. App generates PKCE pair (code_verifier + code_challenge)
3. App redirects to Cognito `/oauth2/authorize` with PKCE parameters
4. Cognito redirects to custom Login UI
5. User authenticates
6. Cognito redirects back to this app's `/callback` with authorization code
7. App exchanges code for tokens using code_verifier
8. App displays user profile and token information

## Testing

Run property-based tests for PKCE utilities:

```bash
npm test
```

## Requirements Implemented

- **1.1**: OAuth2 Authorization Code flow with PKCE
- **1.4**: Token display and validation
- **10.4**: Public client PKCE enforcement
- **12.1**: Custom UI with TheSafeZone styling
