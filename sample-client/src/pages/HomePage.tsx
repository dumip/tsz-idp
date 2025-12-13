/**
 * Home page - Landing page for the sample client
 * Shows login button for unauthenticated users
 * Redirects to profile for authenticated users
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { initiateLogin, isAuthenticated } from '../services/auth';
import styles from './Pages.module.css';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to profile if already authenticated
    if (isAuthenticated()) {
      navigate('/profile', { replace: true });
    }
  }, [navigate]);

  const handleLogin = async () => {
    try {
      await initiateLogin();
    } catch (error) {
      console.error('Failed to initiate login:', error);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>🛡️ TheSafeZone</div>
          <h1 className={styles.title}>Sample Client App</h1>
          <p className={styles.subtitle}>
            Demonstrates OIDC login with PKCE
          </p>
        </div>

        <div className={styles.actions}>
          <button
            className={`${styles.button} ${styles.buttonPrimary} ${styles.buttonFullWidth}`}
            onClick={handleLogin}
          >
            Sign In with TheSafeZone
          </button>
        </div>

        <div style={{ marginTop: 'var(--spacing-xl)', textAlign: 'center' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            This app uses OAuth2 Authorization Code flow with PKCE
            <br />
            to securely authenticate with TheSafeZone IDP.
          </p>
        </div>
      </div>
    </div>
  );
};
