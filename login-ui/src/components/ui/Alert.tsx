import React from 'react';
import styles from './Alert.module.css';

export interface AlertProps {
  variant?: 'success' | 'error' | 'warning' | 'info';
  children: React.ReactNode;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  children,
  className = '',
}) => {
  return (
    <div
      className={`${styles.alert} ${styles[variant]} ${className}`}
      role="alert"
    >
      {children}
    </div>
  );
};
