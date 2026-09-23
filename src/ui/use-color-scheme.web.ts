import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import type { ColorScheme } from './tokens';

const noopSubscribe = () => () => {};

/**
 * Static web rendering has no access to the user's preference, so the server
 * render and the first client render must both use 'light' to avoid a hydration mismatch.
 */
export function useColorScheme(): ColorScheme {
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const scheme = useRNColorScheme();
  if (!hydrated) return 'light';
  return scheme === 'dark' ? 'dark' : 'light';
}
