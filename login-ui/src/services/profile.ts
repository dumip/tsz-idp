/**
 * Profile service for updating user attributes via Cognito
 * Uses the UpdateUserAttributes API
 * 
 * Requirements: 2.1, 2.4, 2.5
 */
import { cognitoConfig } from '../config/cognito';

/**
 * Profile attributes that can be updated
 */
export interface ProfileAttributes {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  interests?: string[];
}

/**
 * Result of a profile update operation
 */
export interface UpdateResult {
  success: boolean;
  error?: string;
}

/**
 * Serialize interests array to JSON string for Cognito storage
 * Requirements: 2.5
 */
export function serializeInterests(interests: string[]): string {
  return JSON.stringify(interests);
}

/**
 * Deserialize interests from JSON string
 * Requirements: 2.5
 */
export function deserializeInterests(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Build Cognito attribute list from profile attributes
 * Only includes provided (non-undefined) fields
 * Requirements: 2.4
 */
export function buildAttributeList(attributes: ProfileAttributes): Array<{ Name: string; Value: string }> {
  const attributeList: Array<{ Name: string; Value: string }> = [];

  if (attributes.displayName !== undefined) {
    attributeList.push({ Name: 'custom:displayName', Value: attributes.displayName });
  }

  if (attributes.firstName !== undefined) {
    attributeList.push({ Name: 'custom:firstName', Value: attributes.firstName });
  }

  if (attributes.lastName !== undefined) {
    attributeList.push({ Name: 'custom:lastName', Value: attributes.lastName });
  }

  if (attributes.interests !== undefined) {
    attributeList.push({ 
      Name: 'custom:interests', 
      Value: serializeInterests(attributes.interests) 
    });
  }

  return attributeList;
}

/**
 * Update user attributes using Cognito API
 * Requirements: 2.1, 2.4
 * 
 * @param accessToken - The user's access token from OAuth2 flow
 * @param attributes - The profile attributes to update
 */
export async function updateUserAttributes(
  accessToken: string,
  attributes: ProfileAttributes
): Promise<UpdateResult> {
  const attributeList = buildAttributeList(attributes);

  if (attributeList.length === 0) {
    return { success: true }; // Nothing to update
  }

  try {
    // Use Cognito's UpdateUserAttributes API directly
    const response = await fetch(
      `https://cognito-idp.${getRegionFromUserPoolId(cognitoConfig.userPoolId)}.amazonaws.com/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.UpdateUserAttributes',
        },
        body: JSON.stringify({
          AccessToken: accessToken,
          UserAttributes: attributeList,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.message || errorData.__type || 'Failed to update profile',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Profile update error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error. Please try again.',
    };
  }
}

/**
 * Extract AWS region from User Pool ID
 * User Pool ID format: region_poolId (e.g., us-east-1_abc123)
 */
function getRegionFromUserPoolId(userPoolId: string): string {
  const parts = userPoolId.split('_');
  return parts[0] || 'us-east-1';
}
