# Requirements Document

## Introduction

This document specifies the requirements for a centralized User Profile Management page in the login-ui application. The profile page allows authenticated users to view and update their profile attributes (DisplayName, FirstName, LastName, Interests) using the Cognito UpdateUserAttributes API. Client applications like sample-client can redirect users to this centralized profile page, providing a consistent profile management experience across all TheSafeZone applications.

## Glossary

- **login-ui**: The centralized identity management UI application that handles device activation and profile management
- **sample-client**: A demonstration client application that showcases integration with the TheSafeZone IDP
- **Profile Page**: A page in login-ui where users can view and edit their profile attributes
- **Access Token**: JWT authorizing access to Cognito APIs, required for UpdateUserAttributes
- **UpdateUserAttributes API**: Cognito API that allows authenticated users to update their own profile attributes
- **Redirect Flow**: The process where a client app redirects to login-ui for profile management and returns after completion
- **Profile Attributes**: User data including DisplayName, FirstName, LastName, and Interests stored as Cognito custom attributes

## Requirements

### Requirement 1: Profile Page in login-ui

**User Story:** As a user, I want to access a profile management page in login-ui, so that I can view and update my profile information from any client application.

#### Acceptance Criteria

1. WHEN a user navigates to /profile in login-ui THEN the TheSafeZone System SHALL display a profile management page with editable fields for DisplayName, FirstName, LastName, and Interests
2. WHEN a user accesses /profile without valid authentication THEN the TheSafeZone System SHALL redirect the user to authenticate via Cognito Managed Login
3. WHEN a user loads the profile page THEN the TheSafeZone System SHALL fetch and display current profile data from the ID token claims
4. WHEN the profile page renders THEN the TheSafeZone System SHALL use consistent styling with the existing login-ui design system

### Requirement 2: Profile Update Functionality

**User Story:** As a user, I want to update my profile attributes, so that my information is current across all TheSafeZone applications.

#### Acceptance Criteria

1. WHEN a user submits profile changes THEN the TheSafeZone System SHALL call the Cognito UpdateUserAttributes API with the access token
2. WHEN profile update succeeds THEN the TheSafeZone System SHALL display a success message and refresh the displayed profile data
3. WHEN profile update fails THEN the TheSafeZone System SHALL display an error message describing the failure reason
4. WHEN a user provides partial profile data THEN the TheSafeZone System SHALL update only the provided fields and retain existing values for unchanged fields
5. WHEN updating the Interests field THEN the TheSafeZone System SHALL serialize the interests array to a JSON string for storage in the custom:interests attribute

### Requirement 3: Client Application Redirect Flow

**User Story:** As a client application developer, I want to redirect users to login-ui for profile management, so that I can provide profile editing without implementing it in each client.

#### Acceptance Criteria

1. WHEN a client application redirects to /profile with a return_url parameter THEN the TheSafeZone System SHALL store the return URL for post-update navigation
2. WHEN a user completes profile editing THEN the TheSafeZone System SHALL redirect back to the stored return_url if provided
3. WHEN no return_url is provided THEN the TheSafeZone System SHALL display a completion message without redirecting
4. WHEN the return_url is from an untrusted origin THEN the TheSafeZone System SHALL reject the redirect and display an error message

### Requirement 4: Sample Client Integration

**User Story:** As a sample-client user, I want to access profile editing from the sample client, so that I can update my profile without leaving the application context.

#### Acceptance Criteria

1. WHEN a user clicks "Edit Profile" in sample-client THEN the sample-client SHALL redirect to login-ui /profile with the sample-client URL as return_url
2. WHEN the user completes profile editing in login-ui THEN the sample-client SHALL receive the redirect and refresh the displayed profile data
3. WHEN integrating profile editing THEN the sample-client SHALL pass the current access token or trigger re-authentication if needed

### Requirement 5: Authentication Token Handling

**User Story:** As a security engineer, I want profile updates to use proper authentication, so that only authorized users can modify their own profiles.

#### Acceptance Criteria

1. WHEN a user accesses /profile from a redirect THEN the TheSafeZone System SHALL authenticate the user via Cognito OAuth2 flow if no valid session exists
2. WHEN calling UpdateUserAttributes THEN the TheSafeZone System SHALL use the user's access token obtained from the OAuth2 flow
3. WHEN the access token expires during profile editing THEN the TheSafeZone System SHALL attempt to refresh the token or prompt re-authentication
4. WHEN authentication fails THEN the TheSafeZone System SHALL redirect to the login flow and return to /profile after successful authentication

