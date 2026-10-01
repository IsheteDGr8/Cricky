import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router, type Href } from 'expo-router';
import { matchPathFromHash } from './share';

/** On web, send old v1 `#match=` links to the Expo match screen. */
export function useLegacyMatchRedirect(): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const path = matchPathFromHash(window.location.hash);
    if (!path) return;
    window.history.replaceState(null, '', path);
    router.replace(path as Href);
  }, []);
}
