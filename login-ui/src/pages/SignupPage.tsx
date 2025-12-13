import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/layout';
import { Card, CardHeader, CardContent, CardFooter, Input, Button, Alert } from '../components/ui';
import { parseOIDCParams, storeOIDCParams } from '../types/oauth';
import { signUp, confirmSignUp, signIn, getGoogleOAuthUrl, completeOIDCFlow, resendConfirmationCode } from '../services/auth';
import type { AuthError } from '../services/auth';
import styles from './AuthPages.module.css';

type SignupStep = 'register' | 'verify';

export const SignupPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<SignupStep>('register');
  
  // Registration form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Verification form state
  const [verificationCode, setVerificationCode] = useState('');
  
  // UI state
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form validation errors
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  
  // Parse and store OIDC params from Cognito redirect
  React.useEffect(() => {
    const oidcParams = parseOIDCParams(searchParams);
    if (oidcParams) {
      storeOIDCParams(oidcParams);
    }
  }, [searchParams]);

  /**
   * Validate password meets requirements
   */
  const validatePassword = (pwd: string): boolean => {
    if (pwd.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return false;
    }
    setPasswordError(null);
    return true;
  };

  /**
   * Validate passwords match
   */
  const validateConfirmPassword = (confirm: string): boolean => {
    if (confirm !== password) {
      setConfirmPasswordError('Passwords do not match');
      return false;
    }
    setConfirmPasswordError(null);
    return true;
  };


  /**
   * Handle registration form submission
   * Implements Requirement 2.1: Create a new user account and send a verification email
   */
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate form
    const isPasswordValid = validatePassword(password);
    const isConfirmValid = validateConfirmPassword(confirmPassword);
    
    if (!isPasswordValid || !isConfirmValid) {
      return;
    }

    setIsLoading(true);

    try {
      const result = await signUp(email, password);
      
      if (result.userConfirmed) {
        // User is already confirmed (auto-verified), proceed to sign in
        await handleSignInAfterVerification();
      } else {
        // User needs to verify email
        setStep('verify');
        setSuccess('A verification code has been sent to your email');
      }
    } catch (err) {
      const authError = err as AuthError;
      setError(authError.message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle verification code submission
   * Implements Requirement 2.1: Verify email after registration
   */
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      await confirmSignUp(email, verificationCode);
      setSuccess('Email verified successfully! Signing you in...');
      
      // Auto sign-in after verification
      await handleSignInAfterVerification();
    } catch (err) {
      const authError = err as AuthError;
      setError(authError.message);
      setIsLoading(false);
    }
  };

  /**
   * Sign in user after successful verification and complete OIDC flow
   */
  const handleSignInAfterVerification = async () => {
    try {
      const tokens = await signIn(email, password);
      completeOIDCFlow(tokens);
    } catch (err) {
      const authError = err as AuthError;
      setError(authError.message);
      setIsLoading(false);
    }
  };

  /**
   * Resend verification code
   */
  const handleResendCode = async () => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      await resendConfirmationCode(email);
      setSuccess('A new verification code has been sent to your email');
    } catch (err) {
      const authError = err as AuthError;
      setError(authError.message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle Google OAuth button click
   * Implements Requirement 3.1: Redirect to Google's OAuth2 authorization endpoint
   */
  const handleGoogleSignup = () => {
    const googleUrl = getGoogleOAuthUrl();
    window.location.href = googleUrl;
  };

  /**
   * Go back to registration step
   */
  const handleBackToRegister = () => {
    setStep('register');
    setVerificationCode('');
    setError(null);
    setSuccess(null);
  };


  // Render verification step
  if (step === 'verify') {
    return (
      <AuthLayout>
        <Card className={styles.authCard}>
          <CardHeader>
            <button 
              type="button" 
              className={styles.backLink} 
              onClick={handleBackToRegister}
              disabled={isLoading}
            >
              ← Back
            </button>
            <h2 className={styles.title}>Verify Your Email</h2>
            <p className={styles.subtitle}>
              Enter the verification code sent to {email}
            </p>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="error" className={styles.message}>
                {error}
              </Alert>
            )}
            {success && (
              <Alert variant="success" className={styles.message}>
                {success}
              </Alert>
            )}
            <form className={styles.form} onSubmit={handleVerify}>
              <Input
                label="Verification Code"
                type="text"
                placeholder="Enter 6-digit code"
                autoComplete="one-time-code"
                required
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                disabled={isLoading}
                className={styles.codeInput}
              />
              <Button 
                type="submit" 
                fullWidth 
                size="lg"
                loading={isLoading}
                disabled={isLoading}
              >
                Verify Email
              </Button>
            </form>
            <p className={styles.instructions}>
              Didn't receive the code?{' '}
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isLoading}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--color-primary)', 
                  cursor: 'pointer',
                  fontWeight: 600,
                  padding: 0,
                }}
              >
                Resend code
              </button>
            </p>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  // Render registration step
  return (
    <AuthLayout>
      <Card className={styles.authCard}>
        <CardHeader>
          <h2 className={styles.title}>Create Account</h2>
          <p className={styles.subtitle}>Join TheSafeZone community</p>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="error" className={styles.message}>
              {error}
            </Alert>
          )}
          <form className={styles.form} onSubmit={handleRegister}>
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
              placeholder="Create a password"
              autoComplete="new-password"
              helperText="At least 8 characters"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) validatePassword(e.target.value);
              }}
              onBlur={() => validatePassword(password)}
              error={passwordError || undefined}
              disabled={isLoading}
            />
            <Input
              label="Confirm Password"
              type="password"
              placeholder="Confirm your password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (confirmPasswordError) validateConfirmPassword(e.target.value);
              }}
              onBlur={() => validateConfirmPassword(confirmPassword)}
              error={confirmPasswordError || undefined}
              disabled={isLoading}
            />
            <Button 
              type="submit" 
              fullWidth 
              size="lg"
              loading={isLoading}
              disabled={isLoading}
            >
              Create Account
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
            onClick={handleGoogleSignup}
            disabled={isLoading}
            type="button"
          >
            <GoogleIcon />
            Continue with Google
          </Button>
        </CardContent>
        <CardFooter>
          <p className={styles.footerText}>
            Already have an account? <Link to="/login">Sign in</Link>
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
