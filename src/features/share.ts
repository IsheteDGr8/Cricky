import * as Linking from 'expo-linking';
import { Platform, Share } from 'react-native';

export type ShareOutcome = 'shared' | 'copied' | 'dismissed';

/**
 * Shares a link to a screen in the app, e.g. `/match/abc`.
 * Browsers without a share sheet get the link copied instead.
 */
export async function shareLink(path: string, title: string): Promise<ShareOutcome> {
  const url = Linking.createURL(path);
  if (Platform.OS === 'web') {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        return 'shared';
      } catch {
        return 'dismissed';
      }
    }
    await navigator.clipboard.writeText(url);
    return 'copied';
  }
  const result = await Share.share({ title, message: `${title}\n${url}`, url });
  return result.action === Share.sharedAction ? 'shared' : 'dismissed';
}
