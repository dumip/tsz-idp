import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/layout';
import { Card, CardHeader, CardContent, CardFooter, Input, Button, Alert } from '../components/ui';
import { parseOIDCParams, storeOIDCParams } from '../types/oauth';
import { signIn, getGoogleOAuthUrl, completeOIDCFlow } from '../services/auth';
import type { AuthError } from '../services/auth';
import styles from './AuthPages.module.css';

export const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Parse and store OIDC params from Cognito redirect
  // Also check for success message from signup/password reset
  React.useEffect(() => {
    const oidcParams = parseOIDCParams(searchParams);
    if (oidcParams) {
      storeOIDCParams(oidcParams);
    }
    
    // Show success message if user just authenticated (from signup or direct login)
    if (searchParams.get('authenticated') === 'true') {
      setSuccess('You are now signed in! You can close this window or sign in again to continue.');
    }
  }, [searchParams]);

  /**
   * Handle email/password form submission
   * Implements Requirement 2.2: Authenticate user and issue tokens within 3 seconds
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const tokens = await signIn(email, password);
      // Complete the OIDC flow by redirecting back to Cognito
      completeOIDCFlow(tokens);
    } catch (err) {
      const authError = err as AuthError;
      // Display uniform error message (Requirement 2.3)
      setError(authError.message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle Google OAuth button click
   * Implements Requirement 3.1: Redirect to Google's OAuth2 authorization endpoint
   */
  const handleGoogleLogin = () => {
    const googleUrl = getGoogleOAuthUrl();
    window.location.href = googleUrl;
  };

  return (
    <AuthLayout>
      <Card className={styles.authCard}>
        <CardHeader>
          <h2 className={styles.title}>Welcome Back</h2>
          <p className={styles.subtitle}>Sign in to your account</p>
        </CardHeader>
        <CardContent>
          {success && (
            <Alert variant="success" className={styles.message}>
              {success}
            </Alert>
          )}
          {error && (
            <Alert variant="error" className={styles.message}>
              {error}
            </Alert>
          )}
          <form className={styles.form} onSubmit={handleSubmit}>
            <Input
              label="Email"
              type="email"
              placeholder="Enter your email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
            <div className={styles.forgotPassword}>
              <Link to="/forgot-password">Forgot password?</Link>
            </div>
            <Button 
              type="submit" 
              fullWidth 
              size="lg"
              loading={isLoading}
              disabled={isLoading}
            >
              Sign In
            </Button>
          </form>
          <div className={styles.divider}>
            <span>or</span>
          </div>
          <Button 
            variant="outline" 
            fullWidth 
            size="lg" 
            className={styles.googleButton}
            onClick={handleGoogleLogin}
            disabled={isLoading}
            type="button"
          >
            <GoogleIcon />
            Continue with Google
          </Button>
        </CardContent>
        <CardFooter>
          <p className={styles.footerText}>
            Don't have an account? <Link to="/signup">Sign up</Link>
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  );
};

const GoogleIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);
