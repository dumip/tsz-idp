# Design Document: TheSafeZone Identity Provider

## Overview

TheSafeZone IDP is an OAuth2/OpenID Connect compliant identity provider built on AWS Cognito, serving the TheSafeZone Social VR platform. The system provides authentication for web, mobile, and VR clients through AWS Cognito Managed Login, supporting email/password registration, Google federation, and anonymous authentication via Cognito Identity Pools.

The architecture prioritizes:
- 100% OAuth2/OIDC compliance using Cognito's standard endpoints
- Cognito Managed Login for branded authentication UI
- Device Code Flow for VR authentication
- Serverless implementation using Lambda, API Gateway, and DynamoDB
- Infrastructure as Code using AWS CDK (TypeScript)

## Architecture

```mermaid
graph TB
    subgraph "Client Applications"
        WEB[Web App]
        MOBILE[Mobile App]
        VR[VR Client]
        SAMPLE[Sample Client]
    end

    subgraph "AWS Cognito"
        UP[User Pool<br/>/oauth2 endpoints]
        ML[Managed Login<br/>Branded UI]
        IP[Identity Pool]
        GOOGLE[Google IdP]
    end

    subgraph "API Layer"
        APIGW[API Gateway]
        subgraph "Lambda Functions"
            DEVICE_CODE[Device Code Lambda]
        end
    end

    subgraph "Storage"
        DDB[DynamoDB<br/>Device Codes]
    end

    WEB -->|OIDC /oauth2/authorize| UP
    MOBILE -->|OIDC /oauth2/authorize| UP
    SAMPLE -->|OIDC /oauth2/authorize| UP
    UP -->|Shows| ML
    ML -->|Auth complete| UP
    UP -->|Tokens via redirect_uri| WEB
    UP -->|Tokens via redirect_uri| MOBILE
    UP -->|Tokens via redirect_uri| SAMPLE

    VR -->|Device Code Flow| APIGW

    APIGW --> DEVICE_CODE
    DEVICE_CODE --> DDB
    DEVICE_CODE --> UP

    UP --> GOOGLE
    UP --> IP
```

### Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| Cognito User Pool | OIDC provider - exposes /oauth2 endpoints, issues tokens, manages users, handles Google federation |
| Cognito Managed Login | AWS-hosted branded login UI - handles sign-in, sign-up, password reset, and social login |
| API Gateway | REST API routing for Device Code operations |
| Device Code Lambda | RFC 8628 Device Code Flow implementation |
| Cognito Identity Pool | Anonymous user identity management (no profile storage) |
| DynamoDB (Device Codes) | Temporary storage for device code flow state |

### Client Integration Flow

Client applications integrate via standard OIDC with Cognito:

1. **Client** → Cognito `/oauth2/authorize` (standard OIDC with PKCE)
2. **Cognito** → Shows Managed Login UI (branded)
3. **User** → Authenticates via email/password or Google
4. **Cognito** → Redirects to client's `redirect_uri` with authorization code
5. **Client** → Exchanges code for tokens at Cognito `/oauth2/token`

This ensures 100% OAuth2/OIDC compliance using standard Cognito endpoints.

### Managed Login Customization

Cognito Managed Login can be customized via User Pool settings:

| Customization | Configuration |
|---------------|---------------|
| Logo | Upload custom logo image |
| Colors | Primary color, background color |
| CSS | Custom CSS for advanced styling |
| Domain | Custom domain or Cognito subdomain |

## Sequence Diagrams

### Web App / Mobile App Authentication Flow (OIDC)

```mermaid
sequenceDiagram
    participant User
    participant App as Web/Mobile App
    participant Cognito as Cognito /oauth2
    participant ManagedLogin as Managed Login UI
    participant Google as Google OAuth

    Note over User,Google: Email/Password Sign In (OIDC Authorization Code + PKCE)
    User->>App: Click "Sign In"
    App->>App: Generate PKCE code_verifier, code_challenge
    App->>Cognito: GET /oauth2/authorize?response_type=code&client_id={id}&redirect_uri={app_callback}&scope=openid email profile&code_challenge={challenge}&code_challenge_method=S256
    Cognito->>ManagedLogin: Show branded login page
    User->>ManagedLogin: Enter email, password
    ManagedLogin->>Cognito: Authenticate user
    Cognito-->>App: Redirect to {app_callback}?code={authorization_code}
    App->>Cognito: POST /oauth2/token grant_type=authorization_code&code={code}&code_verifier={verifier}
    Cognito-->>App: {id_token, access_token, refresh_token}
    App->>App: Store tokens, user authenticated

    Note over User,Google: Email/Password Sign Up
    User->>App: Click "Sign Up"
    App->>Cognito: GET /oauth2/authorize (same as above)
    Cognito->>ManagedLogin: Show branded signup page
    User->>ManagedLogin: Enter email, password
    ManagedLogin->>Cognito: Create user account
    Cognito->>User: Send verification email
    User->>ManagedLogin: Enter verification code
    ManagedLogin->>Cognito: Confirm signup
    Cognito-->>App: Redirect to {app_callback}?code={authorization_code}
    App->>Cognito: POST /oauth2/token
    Cognito-->>App: {id_token, access_token, refresh_token}

    Note over User,Google: Google OAuth Sign In
    User->>App: Click "Sign in with Google"
    App->>App: Generate PKCE code_verifier, code_challenge
    App->>Cognito: GET /oauth2/authorize?...&identity_provider=Google
    Cognito->>Google: Redirect to Google OAuth
    User->>Google: Authenticate with Google
    Google-->>Cognito: Authorization code
    Cognito->>Google: Exchange code for Google tokens
    Google-->>Cognito: Google ID token, access token
    Cognito-->>App: Redirect to {app_callback}?code={authorization_code}
    App->>Cognito: POST /oauth2/token
    Cognito-->>App: {id_token, access_token, refresh_token}
    App->>App: Store tokens, user authenticated
```

### OIDC Authorization Code Flow with PKCE (Detailed)

This is the standard OIDC flow. Client apps initiate auth with Cognito, Cognito shows Managed Login, tokens flow back to the client.

```mermaid
sequenceDiagram
    participant App as Client App
    participant Cognito as Cognito /oauth2
    participant ManagedLogin as Managed Login UI
    participant IdP as Identity Provider (Google)

    Note over App,IdP: 1. Authorization Request (Client initiates)
    App->>App: Generate PKCE pair:<br/>code_verifier = random(43-128 chars)<br/>code_challenge = BASE64URL(SHA256(code_verifier))
    App->>Cognito: GET /oauth2/authorize<br/>?response_type=code<br/>&client_id={client_id}<br/>&redirect_uri={app_callback}<br/>&scope=openid email profile<br/>&state={csrf_token}<br/>&code_challenge={challenge}<br/>&code_challenge_method=S256

    Note over App,IdP: 2. Managed Login Authentication
    Cognito->>ManagedLogin: Show branded login UI
    ManagedLogin->>ManagedLogin: User enters credentials
    ManagedLogin->>Cognito: Authenticate user
    Cognito-->>Cognito: Auth success, generate code

    Note over App,IdP: 3. Authorization Response (to Client)
    Cognito-->>App: Redirect to {app_callback}<br/>?code={authorization_code}<br/>&state={csrf_token}
    App->>App: Verify state matches

    Note over App,IdP: 4. Token Exchange (Client to Cognito)
    App->>Cognito: POST /oauth2/token<br/>Content-Type: application/x-www-form-urlencoded<br/><br/>grant_type=authorization_code<br/>&code={authorization_code}<br/>&redirect_uri={app_callback}<br/>&code_verifier={code_verifier}<br/>&client_id={client_id}

    Note over App,IdP: 5. Token Response (OIDC Compliant)
    Cognito-->>App: {<br/>  "id_token": "{JWT with sub, iss, aud, exp, iat, email...}",<br/>  "access_token": "{JWT}",<br/>  "refresh_token": "{opaque}",<br/>  "token_type": "Bearer",<br/>  "expires_in": 3600<br/>}
```

### Anonymous Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant App as Web/Mobile App
    participant IdentityPool as Cognito Identity Pool

    User->>App: Open app (no login)
    App->>App: Check for stored identity ID
    alt No stored identity
        App->>IdentityPool: GetId()
        IdentityPool-->>App: New Identity ID
        App->>App: Store Identity ID locally
    else Has stored identity
        App->>App: Use stored Identity ID
    end
    App->>IdentityPool: GetCredentialsForIdentity(identityId)
    IdentityPool-->>App: Temporary AWS credentials
    App->>App: User is anonymous, limited features
```

### Device Code Flow (VR Client)

```mermaid
sequenceDiagram
    participant User
    participant VR as VR Client
    participant APIGW as API Gateway
    participant Lambda as Device Code Lambda
    participant DDB as DynamoDB
    participant Phone as User's Phone/PC
    participant Cognito as Cognito (Managed Login)

    Note over User,Cognito: Step 1: VR requests device code
    User->>VR: Select "Login"
    VR->>APIGW: POST /device/code {client_id, scope}
    APIGW->>Lambda: Invoke
    Lambda->>Lambda: Generate device_code, user_code
    Lambda->>DDB: Store {device_code, user_code, status: pending, expires_at}
    Lambda-->>APIGW: {device_code, user_code, verification_uri, expires_in, interval}
    APIGW-->>VR: Response
    VR->>VR: Display: "Go to thesafezone.eu/activate and enter code: ABC-123"

    Note over User,Cognito: Step 2: User authenticates on secondary device
    User->>Phone: Open browser, go to verification_uri
    Phone->>APIGW: GET /activate?user_code=ABC-123
    APIGW->>Lambda: Validate user_code
    Lambda->>DDB: Query by user_code
    DDB-->>Lambda: Device code record (valid)
    Lambda-->>Phone: Redirect to Cognito /oauth2/authorize
    Phone->>Cognito: GET /oauth2/authorize (with device flow state)
    Cognito->>Cognito: Show Managed Login UI
    User->>Cognito: Login (email/password or Google)
    Cognito-->>Phone: Redirect with authorization code
    Phone->>APIGW: POST /device/authorize {code, user_code}
    APIGW->>Lambda: Invoke
    Lambda->>Cognito: Exchange code for tokens
    Cognito-->>Lambda: {access_token, id_token, refresh_token}
    Lambda->>DDB: Update {status: authorized, tokens: {...}}
    Lambda-->>Phone: Success - "Device authorized!"

    Note over User,Cognito: Step 3: VR polls and receives tokens
    loop Every 5 seconds until authorized or expired
        VR->>APIGW: POST /device/token {device_code, client_id}
        APIGW->>Lambda: Invoke
        Lambda->>DDB: Get device code record
        alt Status: pending
            Lambda-->>VR: {error: "authorization_pending"}
        else Status: authorized
            Lambda->>DDB: Delete record
            Lambda-->>VR: {access_token, id_token, refresh_token}
            VR->>VR: Store tokens, user authenticated
        else Status: expired
            Lambda-->>VR: {error: "expired_token"}
        end
    end
```

### Anonymous to Registered Upgrade Flow

```mermaid
sequenceDiagram
    participant User
    participant App as Web/Mobile App
    participant Cognito as Cognito /oauth2
    participant ManagedLogin as Managed Login UI
    participant IdentityPool as Cognito Identity Pool

    Note over User,IdentityPool: User is currently anonymous (has Identity Pool ID)
    User->>App: Click "Create Account"
    App->>App: Generate PKCE, store anonymous_id
    App->>Cognito: GET /oauth2/authorize?...&state={anonymous_id}
    Cognito->>ManagedLogin: Show signup page
    User->>ManagedLogin: Enter email, password
    ManagedLogin->>Cognito: Create user account
    Cognito->>User: Send verification email
    User->>ManagedLogin: Enter verification code
    ManagedLogin->>Cognito: Confirm signup & authenticate
    Cognito-->>App: Redirect with authorization code
    App->>Cognito: POST /oauth2/token
    Cognito-->>App: {id_token, access_token, refresh_token}
    App->>IdentityPool: GetCredentialsForIdentity(identityId, {cognito_token})
    Note over IdentityPool: Links anonymous identity to authenticated user
    IdentityPool-->>App: Updated credentials
    App->>App: User is now registered
```

## Components and Interfaces

### 1. Device Code Lambda

Implements RFC 8628 Device Authorization Grant for VR clients.

```typescript
// Endpoints
POST /device/code          // Generate device code and user code
POST /device/token         // Poll for tokens (VR client)
POST /device/authorize     // User authorizes device (after login)
```

### 2. Profile Lambda

Manages user profile data for registered users only. Anonymous users do not have profile data.

```typescript
// Endpoints
GET  /profile              // Get current user profile (registered users only)
PUT  /profile              // Update profile attributes (registered users only)
GET  /profile/completion   // Get profile completion status
```

## Data Models

### User Profile (Cognito Custom Attributes)

```typescript
interface CognitoUserAttributes {
  email: string;                    // Standard attribute
  email_verified: boolean;          // Standard attribute
  sub: string;                      // Cognito user ID
  
  // Custom attributes (prefixed with custom:)
  'custom:displayName'?: string;    // Max 256 chars
  'custom:firstName'?: string;      // Max 256 chars
  'custom:lastName'?: string;       // Max 256 chars
  'custom:interests'?: string;      // JSON array, max 2048 chars
}
```

### Device Code (DynamoDB)

```typescript
interface DeviceCodeRecord {
  deviceCode: string;               // Partition key
  userCode: string;                 // GSI for lookup
  clientId: string;
  scope: string;
  expiresAt: number;                // Unix timestamp
  interval: number;                 // Polling interval in seconds
  status: 'pending' | 'authorized' | 'denied' | 'expired';
  userId?: string;                  // Set when authorized
  tokens?: {                        // Set when authorized
    accessToken: string;
    idToken: string;
    refreshToken: string;
  };
  ttl: number;                      // DynamoDB TTL
}
```

### Client Application Configuration

```typescript
interface ClientConfig {
  clientId: string;
  clientName: string;
  clientType: 'public' | 'confidential';
  allowedScopes: string[];
  callbackUrls: string[];
  logoutUrls: string[];
  tokenValidity: {
    accessToken: number;            // Minutes
    idToken: number;                // Minutes
    refreshToken: number;           // Days
  };
}
```

### Token Claims

```typescript
interface IdTokenClaims {
  // Standard OIDC claims
  iss: string;                      // Issuer URL
  sub: string;                      // Subject (user ID)
  aud: string;                      // Audience (client ID)
  exp: number;                      // Expiration time
  iat: number;                      // Issued at
  auth_time: number;                // Authentication time
  
  // Profile claims
  email?: string;
  email_verified?: boolean;
  name?: string;                    // DisplayName
  given_name?: string;              // FirstName
  family_name?: string;             // LastName
  
  // Custom claims
  'custom:interests'?: string;      // JSON array string
  'custom:isAnonymous'?: boolean;
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the acceptance criteria analysis, the following correctness properties must be validated through property-based testing:

### Property 1: PKCE Validation
*For any* authorization request, if the request includes a valid code_challenge and code_verifier pair, the authorization SHALL succeed; if the PKCE parameters are missing or invalid, the authorization SHALL fail.
**Validates: Requirements 1.1**

### Property 2: ID Token OIDC Compliance
*For any* authenticated user, the issued ID token SHALL contain all required OIDC claims (iss, sub, aud, exp, iat) with valid formats and values.
**Validates: Requirements 1.2**

### Property 3: Userinfo Response Consistency
*For any* authenticated user, the userinfo endpoint response SHALL contain the same claims as the ID token for that user.
**Validates: Requirements 1.3**

### Property 4: User Registration Idempotence
*For any* valid email and password, registration SHALL create exactly one user; subsequent registration attempts with the same email SHALL fail.
**Validates: Requirements 2.1**

### Property 5: Invalid Credentials Error Uniformity
*For any* invalid credentials (wrong password, non-existent email), the error response SHALL be identical, not revealing whether the email exists.
**Validates: Requirements 2.3**

### Property 6: Password Reset Session Invalidation
*For any* user who completes password reset, all previously issued tokens SHALL become invalid.
**Validates: Requirements 2.5**

### Property 7: Anonymous Identity Uniqueness
*For any* anonymous identity request, the system SHALL return a unique identity ID that persists across subsequent requests with the same device credentials.
**Validates: Requirements 4.1, 4.2**

### Property 8: Upgrade Token Claims
*For any* upgraded user (anonymous to registered), the new tokens SHALL NOT contain the anonymous flag and SHALL contain the registered user's email claim.
**Validates: Requirements 5.3**

### Property 9: Profile Update Round-Trip
*For any* user profile update, the updated values SHALL appear in subsequently retrieved profile data and issued tokens.
**Validates: Requirements 6.1, 6.2, 6.3**

### Property 10: Partial Profile Update Preservation
*For any* partial profile update, fields not included in the update SHALL retain their previous values.
**Validates: Requirements 6.4**

### Property 11: Profile Completion Status Accuracy
*For any* user profile state, the completion status SHALL correctly identify all unpopulated optional fields.
**Validates: Requirements 7.3**

### Property 12: Account Linking Uniqueness
*For any* social account, it SHALL be linked to at most one TheSafeZone user; attempting to link an already-linked account SHALL fail.
**Validates: Requirements 8.1, 8.2**

### Property 13: Multi-Provider Login Equivalence
*For any* user with multiple linked providers, authentication via any linked provider SHALL return tokens with the same user subject (sub) claim.
**Validates: Requirements 8.3**

### Property 14: Unlink Preservation
*For any* user who unlinks a social provider, the user account SHALL continue to exist and be accessible via remaining authentication methods.
**Validates: Requirements 8.4**

### Property 15: Device Code Format and Expiration
*For any* device code request, the generated user_code and device_code SHALL be unique, and the expires_in value SHALL be 600 seconds (10 minutes).
**Validates: Requirements 9.1, 9.2**

### Property 16: Device Code Polling States
*For any* device code, polling before authorization SHALL return "authorization_pending"; polling after authorization SHALL return valid tokens.
**Validates: Requirements 9.4, 9.5**

### Property 17: Client ID Uniqueness
*For any* client registration, the issued client_id SHALL be unique across all registered clients.
**Validates: Requirements 10.1**

### Property 18: Token Audience Correctness
*For any* token request, the issued token's audience (aud) claim SHALL match the requesting client_id.
**Validates: Requirements 10.2**

### Property 19: Cross-Client Identity Consistency
*For any* user authenticating across multiple clients, the subject (sub) claim SHALL be identical in all issued tokens.
**Validates: Requirements 10.3**

### Property 20: Public Client PKCE Enforcement
*For any* public client, authorization requests without PKCE SHALL be rejected; requests with client_secret SHALL be rejected.
**Validates: Requirements 10.4**

### Property 21: Token Lifetime Correctness
*For any* issued token, the access token expiration SHALL be 1 hour from issuance, and refresh token expiration SHALL be 30 days from issuance.
**Validates: Requirements 11.1**

### Property 22: Refresh Token Rotation
*For any* refresh token usage, the response SHALL include new access, ID, and refresh tokens; the original refresh token SHALL become invalid.
**Validates: Requirements 11.2**

### Property 23: Logout Token Revocation
*For any* logout operation, the user's refresh token SHALL become invalid for subsequent refresh attempts.
**Validates: Requirements 11.3**

### Property 24: Token Validation Completeness
*For any* token with invalid signature, expired timestamp, wrong audience, or wrong issuer, validation SHALL fail.
**Validates: Requirements 11.4**

### Property 25: Account Lockout Threshold
*For any* user, exactly 5 consecutive failed login attempts SHALL trigger account lockout; fewer than 5 failures SHALL NOT trigger lockout.
**Validates: Requirements 13.1**

## Error Handling

### Authentication Errors

| Error Code | HTTP Status | Description | User Message |
|------------|-------------|-------------|--------------|
| INVALID_CREDENTIALS | 401 | Wrong email or password | "Invalid email or password" |
| USER_NOT_CONFIRMED | 403 | Email not verified | "Please verify your email" |
| USER_DISABLED | 403 | Account disabled/locked | "Account is temporarily locked" |
| PASSWORD_RESET_REQUIRED | 403 | Admin-initiated reset | "Password reset required" |
| MFA_REQUIRED | 403 | MFA challenge pending | "Additional verification required" |

### Token Errors

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| TOKEN_EXPIRED | 401 | Access token expired |
| TOKEN_INVALID | 401 | Malformed or tampered token |
| TOKEN_REVOKED | 401 | Token has been revoked |
| REFRESH_TOKEN_EXPIRED | 401 | Refresh token expired |

### Device Code Errors

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| authorization_pending | 400 | User hasn't authorized yet |
| slow_down | 400 | Polling too frequently |
| access_denied | 400 | User denied authorization |
| expired_token | 400 | Device code expired |

### Profile Errors

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| PROFILE_NOT_FOUND | 404 | User profile doesn't exist |
| INVALID_INTERESTS | 400 | Interests not valid JSON array |
| ATTRIBUTE_TOO_LONG | 400 | Attribute exceeds max length |
| ANONYMOUS_NO_PROFILE | 403 | Anonymous users cannot access profile features |

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit tests and property-based tests:

- **Unit tests** verify specific examples, edge cases, and integration points
- **Property-based tests** verify universal properties that should hold across all inputs

### Property-Based Testing Framework

**Framework:** [fast-check](https://github.com/dubzzz/fast-check) for TypeScript/Node.js

**Configuration:**
- Minimum 100 iterations per property test
- Seed logging for reproducibility
- Shrinking enabled for minimal failing examples

**Annotation Format:**
Each property-based test must include a comment in this format:
```typescript
// **Feature: thesafezone-idp, Property {number}: {property_text}**
```

### Test Categories

#### 1. Token Tests
- Property tests for OIDC compliance (Properties 2, 3)
- Property tests for token lifetime (Property 21)
- Property tests for token validation (Property 24)
- Unit tests for JWT parsing edge cases

#### 2. Authentication Tests
- Property tests for PKCE validation (Property 1)
- Property tests for credential error uniformity (Property 5)
- Property tests for lockout threshold (Property 28)
- Unit tests for specific auth flows

#### 3. Profile Tests (Registered Users Only)
- Property tests for round-trip consistency (Property 9)
- Property tests for partial update preservation (Property 10)
- Property tests for completion status (Property 11)
- Unit tests for JSON interests validation

#### 4. Device Code Tests
- Property tests for code generation (Property 15)
- Property tests for polling states (Property 16)
- Unit tests for expiration handling

#### 5. Account Linking Tests
- Property tests for linking uniqueness (Property 12)
- Property tests for multi-provider equivalence (Property 13)
- Property tests for unlink preservation (Property 14)

#### 6. Anonymous/Upgrade Tests
- Property tests for identity uniqueness (Property 7)
- Property tests for token claims after upgrade (Property 8)

### Test Data Generators

```typescript
// Example generators for property-based tests
const emailGenerator = fc.emailAddress();
const passwordGenerator = fc.string({ minLength: 8, maxLength: 128 });
const displayNameGenerator = fc.string({ minLength: 1, maxLength: 256 });
const interestsGenerator = fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 20 });
const clientIdGenerator = fc.uuid();
const deviceCodeGenerator = fc.hexaString({ minLength: 32, maxLength: 32 });
const userCodeGenerator = fc.stringOf(fc.constantFrom(...'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'), { minLength: 8, maxLength: 8 });
```

### Integration Tests

Integration tests cover:
- End-to-end authentication flows
- Cognito User Pool operations
- Cognito Identity Pool operations (anonymous identity only, no profile)
- DynamoDB operations for device codes
- Google OAuth federation (mocked external calls)

### Test Environment

- Local testing with mocked AWS services (aws-sdk-mock, @aws-sdk/client-mock)
- Integration testing against real Cognito in a dedicated test environment
- CI/CD pipeline runs property tests with 100+ iterations
