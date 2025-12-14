/**
 * OAuth Callback Handler for Profile Authentication
 * Handles the authorization code exchange after Cognito authentication
 * 
 * Requirements: 5.1, 5.4
 */
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/layout';
import { Card, CardHeader, CardContent, Alert, Button } from '../components/ui';
import { handleCallback, getReturnPath, clearReturnPath } from '../services/auth';
import styles from './AuthPages.module.css';

export const ProfileCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Check for OAuth error
      if (errorParam) {
        setError(errorDescription || errorParam);
        return;
      }

      // Validate required parameters
      if (!code || !state) {
        setError('Missing authorization parameters. Please try again.');
        return;
      }

      try {
        // Exchange code for tokens
        await handleCallback(code, state);
        
        // Get stored return path and redirect
        const returnPath = getReturnPath();
        clearReturnPath();
        
        // Navigate to the profile page (or stored return path)
        navigate(returnPath || '/profile', { replace: true });
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
      }
    };

    processCallback();
  }, [searchParams, navigate]);

  // Show error state
  if (error) {
    return (
      <AuthLayout>
        <Card className={styles.authCard}>
          <CardHeader>
            <h2 className={styles.title}>Authentication Failed</h2>
            <p className={styles.subtitle}>Unable to complete sign in</p>
          </CardHeader>
          <CardContent>
            <Alert variant="error" className={styles.message}>
              {error}
            </Alert>
            <p className={styles.instructions}>
              Please try signing in again. If the problem persists, contact support.
            </p>
            <Button 
              onClick={() => navigate('/profile')} 
              fullWidth 
              size="lg"
              variant="outline"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  // Loading state while processing
  return (
    <AuthLayout>
      <Card className={styles.authCard}>
        <CardHeader>
          <h2 className={styles.title}>Signing In</h2>
          <p className={styles.subtitle}>Please wait...</p>
        </CardHeader>
        <CardContent>
          <p className={styles.instructions}>
            Completing authentication...
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
};
