import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/layout';
import { Card, CardHeader, CardContent, CardFooter, Input, Button, Alert } from '../components/ui';
import { forgotPassword, forgotPasswordSubmit } from '../services/auth';
import type { AuthError } from '../services/auth';
import styles from './AuthPages.module.css';

type Step = 'request' | 'reset';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Handle password reset request
   * Implements Requirement 2.4: Send a reset link to the registered email address
   */
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await forgotPassword(email);
      setSuccess('A verification code has been sent to your email.');
      setStep('reset');
    } catch (err) {
      const authError = err as AuthError;
      setError(authError.message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle password reset submission
   * Implements Requirement 2.4: Complete password reset
   */
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      await forgotPasswordSubmit(email, code, newPassword);
      navigate('/login?reset=success');
    } catch (err) {
      const authError = err as AuthError;
      setError(authError.message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle resend code
   */
  const handleResendCode = async () => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      await forgotPassword(email);
      setSuccess('A new verification code has been sent to your email.');
    } catch (err) {
      const authError = err as AuthError;
      setError(authError.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'reset') {
    return (
      <AuthLayout>
        <Card className={styles.authCard}>
          <CardHeader>
            <h2 className={styles.title}>Reset Password</h2>
            <p className={styles.subtitle}>Enter the code sent to {email}</p>
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
            <form className={styles.form} onSubmit={handleResetPassword}>
              <Input
                label="Verification Code"
                type="text"
                placeholder="Enter verification code"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={isLoading}
              />
              <Input
                label="New Password"
                type="password"
                placeholder="Enter new password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isLoading}
              />
              <Input
                label="Confirm Password"
                type="password"
                placeholder="Confirm new password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
              />
              <Button
                type="submit"
                fullWidth
                size="lg"
                loading={isLoading}
                disabled={isLoading}
              >
                Reset Password
              </Button>
            </form>
            <div className={styles.divider}>
              <span>or</span>
            </div>
            <Button
              variant="outline"
              fullWidth
              size="lg"
              onClick={handleResendCode}
              disabled={isLoading}
              type="button"
            >
              Resend Code
            </Button>
          </CardContent>
          <CardFooter>
            <p className={styles.footerText}>
              Remember your password? <Link to="/login">Sign in</Link>
            </p>
          </CardFooter>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Card className={styles.authCard}>
        <CardHeader>
          <h2 className={styles.title}>Reset Password</h2>
          <p className={styles.subtitle}>Enter your email to receive a reset code</p>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="error" className={styles.message}>
              {error}
            </Alert>
          )}
          <form className={styles.form} onSubmit={handleRequestCode}>
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
            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={isLoading}
              disabled={isLoading}
            >
              Send Reset Code
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <p className={styles.footerText}>
            Remember your password? <Link to="/login">Sign in</Link>
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  );
};
