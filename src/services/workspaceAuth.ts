import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User, 
  signOut 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

/**
 * Google Workspace OAuth Scopes configured for executive intelligence
 */
export const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly'
];

/**
 * Standard Google Account Sign-In Provider (Profile, Email, OpenID)
 * Ensures robust, non-blocked sign-in into the SignalDesk platform.
 */
export const googleLoginProvider = new GoogleAuthProvider();
googleLoginProvider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Google Workspace Extended Provider (Gmail & Calendar scopes for connector ingestion)
 */
export const googleWorkspaceProvider = new GoogleAuthProvider();
SCOPES.forEach(scope => {
  googleWorkspaceProvider.addScope(scope);
});
googleWorkspaceProvider.setCustomParameters({
  prompt: 'consent'
});

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
// Cache the access token strictly in-memory per guidelines
let cachedAccessToken: string | null = null;
let cachedUser: User | null = null;

export interface WorkspaceAuthResult {
  user: User;
  accessToken: string;
}

/**
 * Initialize auth state listener
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      cachedUser = user;
      try {
        const idToken = await user.getIdToken();
        cachedAccessToken = cachedAccessToken || idToken;
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } catch {
        if (onAuthSuccess) onAuthSuccess(user, '');
      }
    } else {
      cachedUser = null;
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Google Account Sign-In with Popup
 * Authenticates the executive session with their verified Google account.
 */
export const googleSignIn = async (): Promise<WorkspaceAuthResult | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleLoginProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    // In Firebase Auth popup, credential.accessToken holds the Google OAuth token; fallback to ID token
    const token = credential?.accessToken || (await result.user.getIdToken()) || '';

    cachedAccessToken = token;
    cachedUser = result.user;

    return { user: result.user, accessToken: token };
  } catch (error: any) {
    console.error('Google account sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Retrieve the current in-memory cached access token
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getCurrentWorkspaceUser = (): User | null => {
  return cachedUser || auth.currentUser;
};

/**
 * Sign out and clear in-memory token cache
 */
export const logout = async (): Promise<void> => {
  try {
    await signOut(auth);
  } finally {
    cachedAccessToken = null;
    cachedUser = null;
  }
};

/**
 * Connects the Google Workspace provider to the SignalDesk backend
 * and triggers immediate canonical ingestion of Gmail messages and Calendar events.
 */
export const connectWorkspaceToBackend = async (
  token: string, 
  user?: User
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const payload = {
      providerId: 'google_workspace',
      authConfig: {
        accessToken: token,
        token: token,
        authProvider: 'Google Workspace OAuth 2.0 PKCE',
        userAccountEmail: user?.email || auth.currentUser?.email || 'executive@company.com',
        userName: user?.displayName || auth.currentUser?.displayName || 'Executive Lead',
        scopes: SCOPES
      }
    };

    const res = await fetch('/api/connectors/connect', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('Failed to sync Google Workspace to backend:', err);
    return { success: false, error: err.message };
  }
};
