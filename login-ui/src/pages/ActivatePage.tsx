import React from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../components/layout';
import { Card, CardHeader, CardContent, CardFooter, Input, Button } from '../components/ui';
import styles from './AuthPages.module.css';

export const ActivatePage: React.FC = () => {
  return (
    <AuthLayout>
      <Card className={styles.authCard}>
        <CardHeader>
          <h2 className={styles.title}>Activate Device</h2>
          <p className={styles.subtitle}>Enter the code shown on your VR headset</p>
        </CardHeader>
        <CardContent>
          <p className={styles.instructions}>
            Look at your VR headset screen and enter the 8-character code displayed there.
          </p>
          <form className={styles.form}>
            <Input
              type="text"
              placeholder="XXXX-XXXX"
              className={styles.codeInput}
              maxLength={9}
              autoComplete="off"
              autoFocus
              required
            />
            <Button type="submit" fullWidth size="lg">
              Activate Device
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <Link to="/login" className={styles.backLink}>
            ← Back to Sign In
          </Link>
        </CardFooter>
      </Card>
    </AuthLayout>
  );
};
