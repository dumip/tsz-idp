/**
 * OAuth callback page
 * Handles the authorization code exchange after Cognito redirects back
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { handleCallback } from '../services/auth';
import styles from './Pages.module.css';

export const CallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Handle OAuth error response
      if (errorParam) {
        setError(errorDescription || errorParam);
        return;
      }

      // Validate required parameters
      if (!code || !state) {
        setError('Missing authorization code or state parameter');
        return;
      }

      try {
        // Exchange code for tokens
        await handleCallback(code, state);
        // Redirect to profile page on success
        navigate('/profile', { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    };

    processCallback();
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.card}>
          <div className={styles.header}>
            <div className={styles.logo}>🛡️ TheSafeZone</div>
            <h1 className={styles.title}>Authentication Failed</h1>
          </div>
          <div className={styles.error}>{error}</div>
          <button
            className={`${styles.button} ${styles.buttonPrimary} ${styles.buttonFullWidth}`}
            onClick={() => navigate('/', { replace: true })}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>🛡️ TheSafeZone</div>
          <h1 className={styles.title}>Signing In...</h1>
        </div>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Completing authentication...</p>
        </div>
      </div>
    </div>
  );
};
