import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  type Dependencies,
} from 'firebase/auth';

/**
 * Web: keep the session in localStorage so scorers stay signed in across reloads. The popup
 * resolver is required for Google sign-in; without it signInWithPopup throws auth/argument-error.
 */
export const authDependencies: Dependencies = {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
};
