import { useState } from 'react';
import { Platform } from 'react-native';

import { useDataLayer } from '../data-provider';
import { isStaff, useSession } from '../session';
import { mapLoadable, type Loadable } from '../loadable';

export function useIsStaff(): Loadable<boolean> {
  return mapLoadable(useSession(), isStaff);
}

/** Google sign-in for admins. On phones, admin sign-in is the website until native Google is wired. */
export function useAdminSignIn() {
  const { auth } = useDataLayer();
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      if (Platform.OS !== 'web') {
        throw new Error('Admin sign-in is on the website for now (Google).');
      }
      await auth.signInWithGooglePopup();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return {
    session,
    staff: session.status === 'ready' && isStaff(session.data),
    signIn,
    signOut: () => auth.signOut(),
    busy,
    error,
  };
}
