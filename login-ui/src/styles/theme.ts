/**
 * TheSafeZone brand styling configuration
 * Based on https://thesafezone.eu/ visual identity
 */

export const theme = {
  colors: {
    // Primary brand colors
    primary: '#6C63FF',        // Purple - main brand color
    primaryDark: '#5A52D5',    // Darker purple for hover states
    primaryLight: '#8B84FF',   // Lighter purple for accents
    
    // Secondary colors
    secondary: '#FF6B6B',      // Coral/red accent
    secondaryDark: '#E55A5A',
    
    // Neutral colors
    background: '#F8F9FA',     // Light gray background
    surface: '#FFFFFF',        // White surface/cards
    surfaceHover: '#F0F0F5',   // Hover state for surfaces
    
    // Text colors
    textPrimary: '#2D3748',    // Dark gray for primary text
    textSecondary: '#718096',  // Medium gray for secondary text
    textMuted: '#A0AEC0',      // Light gray for muted text
    textOnPrimary: '#FFFFFF',  // White text on primary color
    
    // Status colors
    success: '#48BB78',
    error: '#E53E3E',
    warning: '#ECC94B',
    info: '#4299E1',
    
    // Border colors
    border: '#E2E8F0',
    borderFocus: '#6C63FF',
  },
  
  fonts: {
    // Primary font for headings and display text
    heading: "'Baloo Paaji 2', cursive",
    // Secondary font for body text
    body: "'Montserrat', sans-serif",
  },
  
  fontSizes: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    md: '1rem',       // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
  },
  
  fontWeights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  
  spacing: {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '3rem',   // 48px
  },
  
  borderRadius: {
    sm: '0.25rem',   // 4px
    md: '0.5rem',    // 8px
    lg: '1rem',      // 16px
    xl: '1.5rem',    // 24px
    full: '9999px',
  },
  
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
  
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
  },
  
  transitions: {
    fast: '150ms ease-in-out',
    normal: '250ms ease-in-out',
    slow: '350ms ease-in-out',
  },
};

export type Theme = typeof theme;
