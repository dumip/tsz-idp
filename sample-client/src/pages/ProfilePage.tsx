/**
 * Profile page - Displays user profile and token information
 * Shows authenticated user's profile data from ID token claims
 * 
 * Requirements: 1.1 (OIDC compliance), 1.4 (Token display), 12.1 (Custom UI)
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthState, logout, type AuthState } from '../services/auth';
import styles from './Pages.module.css';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState<AuthState | null>(null);

  useEffect(() => {
    const state = getAuthState();
    if (!state) {
      navigate('/', { replace: true });
      return;
    }
    setAuthState(state);
  }, [navigate]);

  const handleLogout = () => {
    logout();
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

        {/* User Profile Section */}
        <div className={styles.profileSection}>
          <h2 className={styles.sectionTitle}>User Profile</h2>
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
