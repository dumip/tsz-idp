import React from 'react';
import styles from './AuthLayout.module.css';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.logo}>
          <h1 className={styles.logoText}>TheSafeZone</h1>
          <p className={styles.tagline}>Social VR Platform</p>
        </div>
        {children}
      </div>
      <footer className={styles.footer}>
        <p>&copy; {new Date().getFullYear()} TheSafeZone. All rights reserved.</p>
      </footer>
    </div>
  );
};
