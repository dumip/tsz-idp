# Implementation Plan

- [x] 1. Set up authentication service for login-ui
  - [x] 1.1 Create auth service with OAuth2 PKCE flow
    - Create `login-ui/src/services/auth.ts` with initiateLogin, handleCallback, getAuthState, isAuthenticated functions
    - Implement PKCE code verifier generation and storage
    - Implement token storage in sessionStorage
    - Extract user profile from ID token claims
    - _Requirements: 5.1, 5.2_
  - [x] 1.2 Write property test for authentication guard
    - **Property 1: Authentication Guard**
    - **Validates: Requirements 1.2, 5.1**
  - [x] 1.3 Create PKCE utility functions
    - Create `login-ui/src/utils/pkce.ts` with generatePKCEPair, storePKCEVerifier, getStoredPKCEVerifier functions
    - Use Web Crypto API for SHA-256 hashing
    - _Requirements: 5.1_

- [x] 2. Create profile service for Cognito API integration
  - [x] 2.1 Create profile service with UpdateUserAttributes
    - Create `login-ui/src/services/profile.ts` with updateUserAttributes function
    - Use amazon-cognito-identity-js SDK (already in dependencies)
    - Map UI fields to Cognito custom attributes
    - Handle interests array serialization to JSON string
    - _Requirements: 2.1, 2.4, 2.5_
  - [x] 2.2 Write property test for interests serialization round-trip
    - **Property 4: Interests Serialization Round-Trip**
    - **Validates: Requirements 2.5**
  - [x] 2.3 Write property test for partial update field handling
    - **Property 3: Partial Update Field Handling**
    - **Validates: Requirements 2.4**

- [x] 3. Create URL validation utility
  - [x] 3.1 Implement trusted origin validation
    - Create `login-ui/src/utils/urlValidation.ts` with isValidReturnUrl function
    - Check against same origin and configured trusted domains
    - Parse VITE_TRUSTED_ORIGINS environment variable
    - _Requirements: 3.4_
  - [x] 3.2 Write property test for untrusted origin rejection
    - **Property 5: Untrusted Origin Rejection**
    - **Validates: Requirements 3.4**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create ProfilePage component
  - [x] 5.1 Create ProfilePage with form and state management
    - Create `login-ui/src/pages/ProfilePage.tsx` with editable fields for DisplayName, FirstName, LastName, Interests
    - Use existing UI components (Card, Input, Button, Alert)
    - Handle loading, success, and error states
    - Parse return_url from URL parameters
    - _Requirements: 1.1, 1.3, 2.2, 2.3_
  - [x] 5.2 Write property test for profile data display consistency
    - **Property 2: Profile Data Display Consistency**
    - **Validates: Requirements 1.3**
  - [x] 5.3 Add authentication guard to ProfilePage
    - Check authentication state on mount
    - Redirect to OAuth2 flow if not authenticated
    - Store return path for post-auth redirect
    - _Requirements: 1.2, 5.1, 5.4_
  - [x] 5.4 Implement profile update submission
    - Call profile service on form submit
    - Display success/error messages
    - Handle redirect to return_url on success
    - _Requirements: 2.1, 2.2, 2.3, 3.2, 3.3_

- [x] 6. Add routing and OAuth callback handling
  - [x] 6.1 Update App.tsx with profile routes
    - Add /profile route to ProfilePage
    - Add /profile/callback route for OAuth callback
    - _Requirements: 1.1_
  - [x] 6.2 Create OAuth callback handler
    - Handle authorization code exchange
    - Redirect to /profile after successful authentication
    - _Requirements: 5.1, 5.4_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Integrate sample-client with profile page
  - [x] 8.1 Add Edit Profile button to sample-client ProfilePage
    - Add button that redirects to login-ui /profile
    - Include return_url parameter with current sample-client URL
    - _Requirements: 4.1_
  - [x] 8.2 Handle return from profile editing
    - Detect return from login-ui (e.g., via URL parameter or state)
    - Refresh profile data display
    - _Requirements: 4.2_

- [x] 9. Update environment configuration
  - [x] 9.1 Add trusted origins configuration
    - Add VITE_TRUSTED_ORIGINS to login-ui .env.example
    - Document the configuration in README
    - _Requirements: 3.4_
  - [x] 9.2 Update login-ui .env.example with profile-related config
    - Ensure all required Cognito config variables are documented
    - _Requirements: 5.2_

- [x] 10. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
