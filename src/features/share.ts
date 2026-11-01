import * as Linking from 'expo-linking';
import { Platform, Share } from 'react-native';

export type ShareOutcome = 'shared' | 'copied' | 'dismissed';

/** v1 shared `https://…/#match=<id>`. After cutover that hash becomes `/match/<id>`. */
export function matchPathFromHash(hash: string): string | null {
  const found = /^#match=([^&]+)/i.exec(hash);
  if (!found?.[1]) return null;
  try {
    return `/match/${encodeURIComponent(decodeURIComponent(found[1]))}`;
  } catch {
    return null;
  }
}

/** A link that opens the score pad with the code already filled in. */
export function scorerPath(matchId: string, code: string): string {
  return `/score/${encodeURIComponent(matchId)}?code=${encodeURIComponent(code)}`;
}

/** Copies text on web; phones get the share sheet, which has Copy. */
export async function copyText(text: string): Promise<ShareOutcome> {
  if (Platform.OS === 'web') {
    await navigator.clipboard.writeText(text);
    return 'copied';
  }
  const result = await Share.share({ message: text });
  return result.action === Share.sharedAction ? 'shared' : 'dismissed';
}

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
