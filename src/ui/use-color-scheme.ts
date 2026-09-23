import { useColorScheme as useRNColorScheme } from 'react-native';

import type { ColorScheme } from './tokens';

export function useColorScheme(): ColorScheme {
  return useRNColorScheme() === 'dark' ? 'dark' : 'light';
}
