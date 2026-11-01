import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { brand, Button, Field, Hero, Icon, onHero, Text, useTheme } from '@/ui';
import { parseCodeInput } from './commit';
import { useRedeemCode } from './hooks';

export interface CodeEntryProps {
  matchId: string;
  /** From a scorer link; redeemed straight away. */
  initialCode?: string;
  onReady?: () => void;
}

/** Lets a scorer redeem the 10-character code for one match. */
export function CodeEntry({ matchId, initialCode, onReady }: CodeEntryProps) {
  const { spacing } = useTheme();
  const { redeem, busy, error, ok } = useRedeemCode(matchId);
  const [code, setCode] = useState(initialCode ?? '');
  const [inputError, setInputError] = useState<string | null>(null);
  const tried = useRef(false);

  useEffect(() => {
    if (ok) onReady?.();
  }, [ok, onReady]);

  useEffect(() => {
    if (!initialCode || tried.current) return;
    tried.current = true;
    void redeem(initialCode);
  }, [initialCode, redeem]);

  if (ok) return null;

  const submit = () => {
    const parsed = parseCodeInput(code, matchId);
    if ('error' in parsed) {
      setInputError(parsed.error);
      return;
    }
    setInputError(null);
    void redeem(parsed.code);
  };
  const shownError = inputError ?? error;

  return (
    <Hero>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="key" size={22} color={brand.gold} />
        <Text variant="heading" style={{ color: onHero.strong }}>
          {busy && initialCode ? 'Checking your scorer link…' : 'Become the scorer'}
        </Text>
      </View>
      <Text style={{ color: onHero.soft }}>
        Paste the scorer link the admin sent you, or type the 10-character code. You stay signed in
        as this match&apos;s scorer on this device, so you only do this once.
      </Text>
      <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: spacing.md }}>
        <Field
          label="Scorer link or code"
          value={code}
          onChangeText={(text) => {
            setCode(text);
            setInputError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="ABCDE 12345"
          onSubmitEditing={submit}
        />
      </View>
      {shownError ? (
        <Text variant="bodyStrong" style={{ color: '#FFB4B4' }}>
          {shownError}
        </Text>
      ) : null}
      <Button
        label="Start scoring"
        variant="gold"
        size="lg"
        loading={busy}
        disabled={code.trim().length < 6}
        onPress={submit}
      />
    </Hero>
  );
}
