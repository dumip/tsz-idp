/**
 * Profile Page - Allows users to view and edit their profile attributes
 * 
 * Requirements: 1.1, 1.3, 2.2, 2.3
 */
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/layout';
import { Card, CardHeader, CardContent, Input, Button, Alert } from '../components/ui';
import { getAuthState, isAuthenticated, initiateLogin, type AuthState } from '../services/auth';
import { updateUserAttributes, type ProfileAttributes } from '../services/profile';
import { validateReturnUrl } from '../utils/urlValidation';
import styles from './AuthPages.module.css';

type ProfileStep = 'loading' | 'editing' | 'saving' | 'success' | 'error';

interface ProfileFormData {
  displayName: string;
  firstName: string;
  lastName: string;
  interests: string;
}

/**
 * Profile Page Component
 * 
 * Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4
 */
export const ProfilePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [step, setStep] = useState<ProfileStep>('loading');
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>({
    displayName: '',
    firstName: '',
    lastName: '',
    interests: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  const [returnUrlError, setReturnUrlError] = useState<string | null>(null);

  // Check authentication and load profile on mount
  useEffect(() => {
    const checkAuthAndLoadProfile = async () => {
      // Validate return_url parameter
      const returnUrlParam = searchParams.get('return_url');
      if (returnUrlParam) {
        const validatedUrl = validateReturnUrl(returnUrlParam);
        if (validatedUrl) {
          setReturnUrl(validatedUrl);
        } else {
          setReturnUrlError('Invalid redirect URL. Cannot return to the requested application.');
        }
      }

      // Check authentication
      if (!isAuthenticated()) {
        // Store current URL for post-auth redirect
        const currentPath = window.location.pathname + window.location.search;
        await initiateLogin(currentPath);
        return;
      }

      // Load profile data
      const state = getAuthState();
      if (!state) {
        await initiateLogin('/profile');
        return;
      }

      setAuthState(state);
      
      // Populate form with current profile data
      const { userProfile } = state;
      setFormData({
        displayName: userProfile.displayName || '',
        firstName: userProfile.firstName || '',
        lastName: userProfile.lastName || '',
        interests: userProfile.interests?.join(', ') || '',
      });
      
      setStep('editing');
    };

    checkAuthAndLoadProfile();
  }, [searchParams]);

  /**
   * Handle form field changes
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  /**
   * Parse interests string into array
   */
  const parseInterests = (interestsStr: string): string[] => {
    if (!interestsStr.trim()) return [];
    return interestsStr
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  };

  /**
   * Handle form submission
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!authState) {
      setError('Not authenticated. Please sign in again.');
      return;
    }

    setStep('saving');
    setError(null);

    try {
      // Build attributes to update (only include changed fields)
      const attributes: ProfileAttributes = {};
      const { userProfile } = authState;

      if (formData.displayName !== (userProfile.displayName || '')) {
        attributes.displayName = formData.displayName;
      }
      if (formData.firstName !== (userProfile.firstName || '')) {
        attributes.firstName = formData.firstName;
      }
      if (formData.lastName !== (userProfile.lastName || '')) {
        attributes.lastName = formData.lastName;
      }
      
      const newInterests = parseInterests(formData.interests);
      const currentInterests = userProfile.interests || [];
      if (JSON.stringify(newInterests) !== JSON.stringify(currentInterests)) {
        attributes.interests = newInterests;
      }

      // Call profile service
      const result = await updateUserAttributes(authState.accessToken, attributes);

      if (result.success) {
        setStep('success');
        
        // Redirect after short delay if return_url is set
        if (returnUrl) {
          setTimeout(() => {
            window.location.href = returnUrl;
          }, 2000);
        }
      } else {
        setStep('editing');
        setError(result.error || 'Failed to update profile. Please try again.');
      }
    } catch (err) {
      console.error('Profile update error:', err);
      setStep('editing');
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    }
  };

  /**
   * Handle cancel - return to return_url or show message
   */
  const handleCancel = () => {
    if (returnUrl) {
      window.location.href = returnUrl;
    } else {
      navigate('/');
    }
  };

  // Show return URL error if present
  if (returnUrlError) {
    return (
      <AuthLayout>
        <Card className={styles.authCard}>
          <CardHeader>
            <h2 className={styles.title}>Invalid Redirect</h2>
            <p className={styles.subtitle}>Cannot complete this request</p>
          </CardHeader>
          <CardContent>
            <Alert variant="error" className={styles.message}>
              {returnUrlError}
            </Alert>
            <p className={styles.instructions}>
              The application that sent you here provided an invalid return URL.
              For security reasons, we cannot redirect you to untrusted destinations.
            </p>
            <Button onClick={() => navigate('/')} fullWidth size="lg" variant="outline">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  // Loading state
  if (step === 'loading') {
    return (
      <AuthLayout>
        <Card className={styles.authCard}>
          <CardHeader>
            <h2 className={styles.title}>Loading Profile</h2>
            <p className={styles.subtitle}>Please wait...</p>
          </CardHeader>
          <CardContent>
            <p className={styles.instructions}>
              Loading your profile information...
            </p>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  // Success state
  if (step === 'success') {
    return (
      <AuthLayout>
        <Card className={styles.authCard}>
          <CardHeader>
            <h2 className={styles.title}>Profile Updated!</h2>
            <p className={styles.subtitle}>Your changes have been saved</p>
          </CardHeader>
          <CardContent>
            <Alert variant="success" className={styles.message}>
              Your profile has been updated successfully.
            </Alert>
            {returnUrl ? (
              <p className={styles.instructions}>
                Redirecting you back to the application...
              </p>
            ) : (
              <>
                <p className={styles.instructions}>
                  Your profile changes are now visible across all TheSafeZone applications.
                </p>
                <Button onClick={() => setStep('editing')} fullWidth size="lg" variant="outline">
                  Edit Again
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  // Editing/Saving state
  return (
    <AuthLayout>
      <Card className={styles.authCard}>
        <CardHeader>
          <h2 className={styles.title}>Edit Profile</h2>
          <p className={styles.subtitle}>Update your profile information</p>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="error" className={styles.message}>
              {error}
            </Alert>
          )}
          
          <form className={styles.form} onSubmit={handleSubmit}>
            <Input
              label="Display Name"
              name="displayName"
              value={formData.displayName}
              onChange={handleChange}
              placeholder="How you want to be known"
              disabled={step === 'saving'}
            />
            
            <Input
              label="First Name"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              placeholder="Your first name"
              disabled={step === 'saving'}
            />
            
            <Input
              label="Last Name"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Your last name"
              disabled={step === 'saving'}
            />
            
            <Input
              label="Interests"
              name="interests"
              value={formData.interests}
              onChange={handleChange}
              placeholder="Gaming, Music, Art (comma-separated)"
              helperText="Enter your interests separated by commas"
              disabled={step === 'saving'}
            />
            
            <Button 
              type="submit" 
              fullWidth 
              size="lg"
              loading={step === 'saving'}
              disabled={step === 'saving'}
            >
              Save Changes
            </Button>
            
            <Button 
              type="button"
              variant="outline"
              fullWidth 
              size="lg"
              onClick={handleCancel}
              disabled={step === 'saving'}
            >
              Cancel
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
};
