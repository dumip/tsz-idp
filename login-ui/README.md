# TheSafeZone Login UI

Centralized identity management UI for TheSafeZone applications. Handles device activation for VR headsets and user profile management.

## Features

- **Device Activation**: Allows users to activate VR devices using a code displayed on the headset
- **Profile Management**: Centralized profile editing page for all TheSafeZone applications

## Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your Cognito configuration values in `.env`

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `VITE_COGNITO_CLIENT_ID` | Cognito App Client ID |
| `VITE_COGNITO_DOMAIN` | Cognito domain for OAuth endpoints |
| `VITE_API_ENDPOINT` | API Gateway endpoint for Device Code flow |
| `VITE_TRUSTED_ORIGINS` | Comma-separated list of trusted origins for profile redirects |

## Profile Management

The profile page (`/profile`) allows users to edit their profile attributes:
- Display Name
- First Name
- Last Name
- Interests

### Client Integration

Client applications can redirect users to the profile page for editing:

```typescript
const loginUiUrl = 'https://login.thesafezone.com';
const returnUrl = encodeURIComponent(window.location.href);
window.location.href = `${loginUiUrl}/profile?return_url=${returnUrl}`;
```

After editing, users are redirected back to the `return_url` if it's from a trusted origin.

### Trusted Origins

For security, only URLs from trusted origins are allowed for redirects. Configure trusted origins in the `VITE_TRUSTED_ORIGINS` environment variable:

```
VITE_TRUSTED_ORIGINS=https://app.thesafezone.com,https://sample.thesafezone.com
```

## Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Building

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```
