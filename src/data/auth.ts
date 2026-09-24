import {
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type Auth,
} from 'firebase/auth';
import type { Unsubscribe } from './context';
import type { AccessRepository } from './repositories/access';
import type { Role } from './schemas';

export interface Session {
  uid: string;
  /** Scorers sign in anonymously; admins with Google or Apple. */
  isAnonymous: boolean;
  role: Role | null;
}

/**
 * Sign-in for the three kinds of user:
 * viewers need nothing; scorers get an anonymous session and redeem a code;
 * admins sign in with Google or Apple and hold a role in /roles.
 */
export function createAuthService(auth: Auth, access: AccessRepository) {
  return {
    /** Current session (null when signed out), updated when the user or their role changes. */
    watchSession(onChange: (session: Session | null) => void): Unsubscribe {
      let stopRole: Unsubscribe | null = null;
      const stopAuth = onAuthStateChanged(auth, (user) => {
        stopRole?.();
        stopRole = null;
        if (!user) {
          onChange(null);
          return;
        }
        const base = { uid: user.uid, isAnonymous: user.isAnonymous };
        stopRole = access.watchRole(user.uid, {
          onData: (role) => onChange({ ...base, role }),
          onError: () => onChange({ ...base, role: null }),
        });
      });
      return () => {
        stopRole?.();
        stopAuth();
      };
    },

    /** Scorers: an anonymous session, kept across app restarts. Returns the uid. */
    async ensureSignedIn(): Promise<string> {
      if (auth.currentUser) return auth.currentUser.uid;
      return (await signInAnonymously(auth)).user.uid;
    },

    /** Admins on web. */
    async signInWithGooglePopup(): Promise<void> {
      await signInWithPopup(auth, new GoogleAuthProvider());
    },

    /** Admins on iOS/Android, with the ID token from the native Google sign-in sheet. */
    async signInWithGoogleIdToken(idToken: string): Promise<void> {
      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    },

    /** Admins on iOS, with the identity token and the raw nonce used to request it. */
    async signInWithApple(idToken: string, rawNonce: string): Promise<void> {
      const credential = new OAuthProvider('apple.com').credential({ idToken, rawNonce });
      await signInWithCredential(auth, credential);
    },

    async signOut(): Promise<void> {
      await signOut(auth);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
