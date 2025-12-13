import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/layout';
import { Card, CardContent, Alert } from '../components/ui';
import styles from './AuthPages.module.css';

/**
 * OAuth2 callback page
 * Handles the authorization code returned from Cognito after successful authentication
 * This page processes the code and redirects back to the original client application
 */
export const OAuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = React.useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = React.useState<string>('');

  React.useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      setStatus('error');
      setErrorMessage(errorDescription || error);
      return;
    }

    if (code) {
      // In a real implementation, this would:
      // 1. Exchange the code for tokens
      // 2. Redirect back to the original client application
      // For now, we just show success
      setStatus('success');
      console.log('Authorization code received:', code);
      console.log('State:', state);
    } else {
      setStatus('error');
      setErrorMessage('No authorization code received');
    }
  }, [searchParams]);

  return (
    <AuthLayout>
      <Card className={styles.authCard}>
        <CardContent>
          {status === 'processing' && (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              <p className={styles.subtitle}>Processing authentication...</p>
            </div>
          )}
          {status === 'success' && (
            <Alert variant="success">
              Authentication successful! Redirecting...
            </Alert>
          )}
          {status === 'error' && (
            <Alert variant="error">
              Authentication failed: {errorMessage}
            </Alert>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  );
};
