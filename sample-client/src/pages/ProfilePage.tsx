/**
 * Profile page - Displays user profile and token information
 * Shows authenticated user's profile data from ID token claims
 * 
 * Requirements: 1.1 (OIDC compliance), 1.4 (Token display), 12.1 (Custom UI), 4.1, 4.2
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAuthState, logout, initiateLogin, clearAuthState, type AuthState } from '../services/auth';
import styles from './Pages.module.css';

// Login UI URL for profile editing (default to Vite's default port)
const LOGIN_UI_URL = import.meta.env.VITE_LOGIN_UI_URL || 'http://localhost:5173';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [profileUpdated, setProfileUpdated] = useState(false);

  useEffect(() => {
    // Check if returning from profile edit
    // Requirements: 4.2
    const fromEdit = searchParams.get('profile_updated');
    if (fromEdit === 'true') {
      // Clear old auth state and re-authenticate to get fresh tokens with updated claims
      clearAuthState();
      // Store flag in sessionStorage to show success message after re-auth
      sessionStorage.setItem('profile_just_updated', 'true');
      // Trigger re-authentication - this will redirect to Cognito and back
      initiateLogin();
      return;
    }

    const state = getAuthState();
    if (!state) {
      navigate('/', { replace: true });
      return;
    }
    setAuthState(state);
    
    // Check if we just completed re-auth after profile update
    const justUpdated = sessionStorage.getItem('profile_just_updated');
    if (justUpdated === 'true') {
      setProfileUpdated(true);
      sessionStorage.removeItem('profile_just_updated');
    }
  }, [navigate, searchParams]);

  const handleLogout = () => {
    logout();
  };

  /**
   * Handle Edit Profile button click
   * Redirects to login-ui /profile with return_url
   * Requirements: 4.1
   */
  const handleEditProfile = () => {
    const returnUrl = encodeURIComponent(`${window.location.origin}/profile?profile_updated=true`);
    window.location.href = `${LOGIN_UI_URL}/profile?return_url=${returnUrl}`;
  };

  if (!authState) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.card}>
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  const { userProfile, idTokenClaims, expiresAt, refreshToken } = authState;
  const isExpired = expiresAt < Date.now();
  const expiresIn = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  const expiresInMinutes = Math.floor(expiresIn / 60);
  const expiresInSeconds = expiresIn % 60;

  return (
    <div className={styles.pageContainer}>
      <div className={`${styles.card} ${styles.cardWide}`}>
        <div className={styles.header}>
          <div className={styles.logo}>🛡️ TheSafeZone</div>
          <h1 className={styles.title}>Welcome!</h1>
          <p className={styles.subtitle}>You are signed in</p>
        </div>

        {/* Profile Updated Message */}
        {profileUpdated && (
          <div className={styles.successMessage}>
            ✓ Your profile has been updated successfully!
          </div>
        )}

        {/* User Profile Section */}
        <div className={styles.profileSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>User Profile</h2>
            <button
              className={`${styles.button} ${styles.buttonSecondary}`}
              onClick={handleEditProfile}
            >
              Edit Profile
            </button>
          </div>
          <div className={styles.profileGrid}>
            <ProfileItem 
              label="Display Name" 
              value={userProfile.displayName} 
            />
            <ProfileItem 
              label="First Name" 
              value={userProfile.firstName} 
            />
            <ProfileItem 
              label="Last Name" 
              value={userProfile.lastName} 
            />
            <ProfileItem 
              label="Email" 
              value={userProfile.email} 
            />
            <ProfileItem 
              label="Email Verified" 
              value={userProfile.emailVerified ? 'Yes' : 'No'} 
            />
            <div className={styles.profileItem}>
              <span className={styles.profileLabel}>Interests</span>
              {userProfile.interests && userProfile.interests.length > 0 ? (
                <div className={styles.interestsTags}>
                  {userProfile.interests.map((interest, index) => (
                    <span key={index} className={styles.interestTag}>
                      {interest}
                    </span>
                  ))}
                </div>
              ) : (
                <span className={`${styles.profileValue} ${styles.profileValueMuted}`}>
                  Not set
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Token Information Section */}
        <div className={styles.tokenSection}>
          <h2 className={styles.sectionTitle}>Token Information</h2>
          
          <div className={styles.tokenItem}>
            <div className={styles.tokenLabel}>Access Token Status</div>
            <div className={styles.tokenStatus}>
              <span 
                className={`${styles.statusDot} ${isExpired ? styles.statusExpired : styles.statusActive}`} 
              />
              {isExpired ? (
                <span>Expired</span>
              ) : (
                <span>Active - expires in {expiresInMinutes}m {expiresInSeconds}s</span>
              )}
            </div>
          </div>

          <div className={styles.tokenItem}>
            <div className={styles.tokenLabel}>Refresh Token</div>
            <div className={styles.tokenStatus}>
              <span 
                className={`${styles.statusDot} ${refreshToken ? styles.statusActive : styles.statusExpired}`} 
              />
              {refreshToken ? 'Present' : 'Not available'}
            </div>
          </div>
        </div>

        {/* ID Token Claims Section */}
        <div className={styles.profileSection}>
          <h2 className={styles.sectionTitle}>ID Token Claims</h2>
          <div className={styles.profileGrid}>
            <ProfileItem 
              label="Subject (sub)" 
              value={idTokenClaims.sub} 
            />
            <ProfileItem 
              label="Issuer (iss)" 
              value={idTokenClaims.iss} 
            />
            <ProfileItem 
              label="Audience (aud)" 
              value={idTokenClaims.aud} 
            />
            <ProfileItem 
              label="Issued At (iat)" 
              value={new Date(idTokenClaims.iat * 1000).toLocaleString()} 
            />
            <ProfileItem 
              label="Expires (exp)" 
              value={new Date(idTokenClaims.exp * 1000).toLocaleString()} 
            />
            {idTokenClaims.auth_time && (
              <ProfileItem 
                label="Auth Time" 
                value={new Date(idTokenClaims.auth_time * 1000).toLocaleString()} 
              />
            )}
          </div>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button
            className={`${styles.button} ${styles.buttonDanger} ${styles.buttonFullWidth}`}
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Profile item component for displaying label/value pairs
 */
const ProfileItem: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <div className={styles.profileItem}>
    <span className={styles.profileLabel}>{label}</span>
    <span className={value ? styles.profileValue : `${styles.profileValue} ${styles.profileValueMuted}`}>
      {value || 'Not set'}
    </span>
  </div>
);
