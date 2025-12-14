import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/layout';
import { Card, CardHeader, CardContent, Input, Button, Alert } from '../components/ui';
import {
  isValidUserCodeFormat,
  formatUserCode,
  normalizeUserCode,
  getDeviceActivationOAuthUrl,
  exchangeCodeForTokens,
  authorizeDevice,
  parseDeviceActivationState,
  storeDeviceFlowState,
  getDeviceFlowState,
  clearDeviceFlowState,
} from '../services/device';
import styles from './AuthPages.module.css';

type ActivationStep = 'enter_code' | 'authenticating' | 'authorizing' | 'success' | 'error';

/**
 * Device Activation Page for VR authentication
 * 
 * Flow:
 * 1. User enters the code displayed on their VR headset
 * 2. Page redirects to Cognito Managed Login for authentication
 * 3. After auth, Cognito redirects back with authorization code
 * 4. Page exchanges code for tokens and calls /device/authorize
 * 5. VR device can now poll and receive tokens
 * 
 * Requirements: 9.3
 */
export const ActivatePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [userCode, setUserCode] = useState('');
  const [step, setStep] = useState<ActivationStep>('enter_code');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Handle OAuth callback from Cognito
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Check for OAuth error
      if (errorParam) {
        setStep('error');
        setError(errorDescription || errorParam);
        clearDeviceFlowState();
        return;
      }

      // Check if this is an OAuth callback
      if (!code || !state) {
        return;
      }

      // Parse the state to get the user code
      const deviceState = parseDeviceActivationState(state);
      if (!deviceState) {
        // Also check session storage for the user code (fallback)
        const storedState = getDeviceFlowState();
        if (!storedState) {
          setStep('error');
          setError('Invalid activation state. Please try again.');
          return;
        }
        // Use stored state
        await completeDeviceAuthorization(code, storedState.userCode);
        return;
      }

      await completeDeviceAuthorization(code, deviceState.userCode);
    };

    handleOAuthCallback();
  }, [searchParams]);

  /**
   * Complete the device authorization after OAuth callback
   */
  const completeDeviceAuthorization = async (authCode: string, deviceUserCode: string) => {
    setStep('authorizing');
    setUserCode(formatUserCode(deviceUserCode));

    try {
      // Exchange authorization code for tokens
      const tokens = await exchangeCodeForTokens(
        authCode,
        `${window.location.origin}/activate`
      );

      // Authorize the device with the tokens
      const result = await authorizeDevice(
        deviceUserCode,
        tokens.accessToken,
        tokens.idToken,
        tokens.refreshToken
      );

      if (result.success) {
        setStep('success');
        clearDeviceFlowState();
      } else {
        setStep('error');
        setError(result.errorDescription || 'Failed to authorize device');
        clearDeviceFlowState();
      }
    } catch (err) {
      console.error('Device authorization error:', err);
      setStep('error');
      setError(err instanceof Error ? err.message : 'Failed to complete device authorization');
      clearDeviceFlowState();
    }
  };

  /**
   * Handle user code input change
   * Auto-format with hyphen
   */
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase();
    // Remove any non-alphanumeric characters except hyphen
    value = value.replace(/[^A-Z0-9-]/g, '');
    // Remove existing hyphens for processing
    const cleaned = value.replace(/-/g, '');
    // Add hyphen after 4 characters
    if (cleaned.length > 4) {
      value = `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
    } else {
      value = cleaned;
    }
    setUserCode(value);
    setError(null);
  };

  /**
   * Handle form submission - validate code and redirect to Cognito
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalized = normalizeUserCode(userCode);

    // Validate code format
    if (!isValidUserCodeFormat(normalized)) {
      setError('Please enter a valid 8-character code');
      return;
    }

    setIsLoading(true);
    setStep('authenticating');

    // Store the user code in session storage as backup
    storeDeviceFlowState(normalized);

    // Redirect to Cognito for authentication
    const oauthUrl = getDeviceActivationOAuthUrl(normalized);
    window.location.href = oauthUrl;
  };

  /**
   * Handle retry - go back to code entry
   */
  const handleRetry = () => {
    setStep('enter_code');
    setUserCode('');
    setError(null);
    setIsLoading(false);
    clearDeviceFlowState();
    // Clear URL params
    window.history.replaceState({}, '', '/activate');
  };

  // Render based on current step
  return (
    <AuthLayout>
      <Card className={styles.authCard}>
        {step === 'enter_code' && (
          <>
            <CardHeader>
              <h2 className={styles.title}>Activate Device</h2>
              <p className={styles.subtitle}>Enter the code shown on your VR headset</p>
            </CardHeader>
            <CardContent>
              <p className={styles.instructions}>
                Look at your VR headset screen and enter the 8-character code displayed there.
              </p>
              {error && (
                <Alert variant="error" className={styles.message}>
                  {error}
                </Alert>
              )}
              <form className={styles.form} onSubmit={handleSubmit}>
                <Input
                  type="text"
                  placeholder="XXXX-XXXX"
                  className={styles.codeInput}
                  value={userCode}
                  onChange={handleCodeChange}
                  maxLength={9}
                  autoComplete="off"
                  autoFocus
                  required
                  disabled={isLoading}
                />
                <Button 
                  type="submit" 
                  fullWidth 
                  size="lg"
                  loading={isLoading}
                  disabled={isLoading || userCode.replace(/-/g, '').length !== 8}
                >
                  Activate Device
                </Button>
              </form>
            </CardContent>
          </>
        )}

        {step === 'authenticating' && (
          <>
            <CardHeader>
              <h2 className={styles.title}>Redirecting...</h2>
              <p className={styles.subtitle}>Please wait while we redirect you to sign in</p>
            </CardHeader>
            <CardContent>
              <p className={styles.instructions}>
                You will be redirected to sign in with your TheSafeZone account.
              </p>
            </CardContent>
          </>
        )}

        {step === 'authorizing' && (
          <>
            <CardHeader>
              <h2 className={styles.title}>Authorizing Device</h2>
              <p className={styles.subtitle}>Please wait...</p>
            </CardHeader>
            <CardContent>
              <p className={styles.instructions}>
                Linking your account to the device with code: <strong>{userCode}</strong>
              </p>
            </CardContent>
          </>
        )}

        {step === 'success' && (
          <>
            <CardHeader>
              <h2 className={styles.title}>Device Activated!</h2>
              <p className={styles.subtitle}>Your VR headset is now connected</p>
            </CardHeader>
            <CardContent>
              <Alert variant="success" className={styles.message}>
                Success! Your VR device has been authorized. You can now put on your headset and continue.
              </Alert>
              <p className={styles.instructions}>
                The code <strong>{userCode}</strong> has been activated. Your VR headset will automatically sign you in.
              </p>
              <Button 
                onClick={handleRetry} 
                fullWidth 
                size="lg"
                variant="outline"
              >
                Activate Another Device
              </Button>
            </CardContent>
          </>
        )}

        {step === 'error' && (
          <>
            <CardHeader>
              <h2 className={styles.title}>Activation Failed</h2>
              <p className={styles.subtitle}>Something went wrong</p>
            </CardHeader>
            <CardContent>
              <Alert variant="error" className={styles.message}>
                {error || 'An unexpected error occurred'}
              </Alert>
              <p className={styles.instructions}>
                Please check the code on your VR headset and try again. Make sure the code hasn't expired.
              </p>
              <Button 
                onClick={handleRetry} 
                fullWidth 
                size="lg"
                variant="outline"
              >
                Try Again
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </AuthLayout>
  );
};
