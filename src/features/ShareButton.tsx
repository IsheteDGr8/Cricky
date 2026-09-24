import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';

import { minTouchTarget, useTheme } from '@/ui';
import { shareLink } from './share';

/**
 * Header button that shares a link to `path`. Browsers without a share sheet copy the link;
 * the icon turns into a tick for a moment to confirm.
 */
export function ShareButton({ path, title }: { path: string; title: string }) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copied ? 'Link copied' : `Share ${title}`}
      hitSlop={8}
      onPress={() => {
        shareLink(path, title)
          .then((outcome) => setCopied(outcome === 'copied'))
          .catch(() => setCopied(false));
      }}
      style={({ pressed }) => ({
        width: minTouchTarget,
        height: minTouchTarget,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}>
      <Ionicons
        name={copied ? 'checkmark' : 'share-outline'}
        size={22}
        color={copied ? colors.success : colors.primary}
      />
    </Pressable>
  );
}
