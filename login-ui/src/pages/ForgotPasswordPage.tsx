import React from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../components/layout';
import { Card, CardHeader, CardContent, CardFooter, Input, Button } from '../components/ui';
import styles from './AuthPages.module.css';

export const ForgotPasswordPage: React.FC = () => {
  return (
    <AuthLayout>
      <Card className={styles.authCard}>
        <CardHeader>
          <h2 className={styles.title}>Reset Password</h2>
          <p className={styles.subtitle}>Enter your email to receive a reset code</p>
        </CardHeader>
        <CardContent>
          <form className={styles.form}>
            <Input
              label="Email"
              type="email"
              placeholder="Enter your email"
              autoComplete="email"
              required
            />
            <Button type="submit" fullWidth size="lg">
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
