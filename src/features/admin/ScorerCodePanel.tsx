import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { brand, Button, Icon, Text, useTheme } from '@/ui';
import { confirmAction } from '../confirm';
import { useDataLayer } from '../data-provider';
import { copyText, scorerPath, shareLink } from '../share';

/** "ABCDE12345" as "ABCDE 12345" so it is easy to read aloud. */
export function spacedCode(code: string): string {
  return code.replace(/(.{5})(?=.)/g, '$1 ');
}

export interface ScorerCodePanelProps {
  matchId: string;
  title: string;
  /** A code you just issued, so the panel does not need to fetch it. */
  initialCode?: string;
  compact?: boolean;
}

/** Shows a match's scorer code with one-tap copy and share, and opens scoring if it is closed. */
export function ScorerCodePanel({ matchId, title, initialCode, compact }: ScorerCodePanelProps) {
  const { colors, spacing, radius, fonts } = useTheme();
  const { access } = useDataLayer();
  const [code, setCode] = useState<string | null | undefined>(initialCode);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialCode) return;
    let alive = true;
    access
      .getScorerCode(matchId)
      .then((found) => alive && setCode(found))
      .catch(() => alive && setCode(null));
    return () => {
      alive = false;
    };
  }, [access, initialCode, matchId]);

  const issue = async (replacing: boolean) => {
    if (
      replacing &&
      !(await confirmAction(
        'New scorer code',
        'Anyone scoring with the old code is signed out of this match.',
      ))
    ) {
      return;
    }
    setBusy(true);
    try {
      setCode(await access.issueScorerCode(matchId));
      setNote(replacing ? 'New code ready. The old one no longer works.' : null);
    } catch (error) {
      setNote(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const flash = (text: string) => {
    setNote(text);
    setTimeout(() => setNote(null), 2500);
  };

  if (code === undefined) {
    return (
      <Text variant="caption" color="textMuted">
        Checking scorer code…
      </Text>
    );
  }

  if (code === null) {
    return (
      <View style={{ gap: spacing.sm }}>
        <Button
          label="Open scoring"
          icon={<Icon name="key-outline" size={18} color={colors.onPrimary} />}
          loading={busy}
          onPress={() => void issue(false)}
        />
        {note ? <Text color="danger">{note}</Text> : null}
      </View>
    );
  }

  return (
    <View
      style={{
        gap: spacing.md,
        padding: compact ? spacing.md : spacing.lg,
        borderRadius: radius.md,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: brand.gold,
        backgroundColor: '#FBF8F1',
      }}>
      <View style={{ gap: spacing.xxs }}>
        <Text variant="label" style={{ color: '#85764F' }}>
          Scorer code
        </Text>
        <Text
          selectable
          accessibilityLabel={`Scorer code ${code.split('').join(' ')}`}
          style={{
            fontFamily: fonts.mono,
            fontSize: compact ? 22 : 30,
            lineHeight: compact ? 28 : 38,
            fontWeight: '800',
            letterSpacing: 2,
            color: brand.bar,
          }}>
          {spacedCode(code)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Button
          label="Share scorer link"
          variant="gold"
          icon={<Icon name="link-outline" size={18} color={brand.bar} />}
          onPress={() => {
            void shareLink(scorerPath(matchId, code), `Score ${title}`).then((outcome) => {
              if (outcome === 'copied')
                flash('Scorer link copied. It opens the pad with the code in.');
            });
          }}
        />
        <Button
          label="Copy code"
          variant="secondary"
          icon={<Icon name="copy-outline" size={18} color={colors.text} />}
          onPress={() => {
            void copyText(code).then((outcome) => {
              if (outcome === 'copied') flash('Code copied.');
            });
          }}
        />
        {compact ? null : (
          <Button
            label="New code"
            variant="ghost"
            loading={busy}
            onPress={() => void issue(true)}
          />
        )}
      </View>
      {note ? (
        <Text variant="caption" color="textMuted">
          {note}
        </Text>
      ) : null}
    </View>
  );
}
