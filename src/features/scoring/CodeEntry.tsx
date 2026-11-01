import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { brand, Button, Field, Hero, Icon, onHero, Text, useTheme } from '@/ui';
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

  return (
    <Hero>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="key" size={22} color={brand.gold} />
        <Text variant="heading" style={{ color: onHero.strong }}>
          {busy && initialCode ? 'Checking your scorer link…' : 'Enter the scorer code'}
        </Text>
      </View>
      <Text style={{ color: onHero.soft }}>
        The admin has a 10-character code for this match. Spaces and dashes are fine. You stay
        signed in on this device, so you only do this once.
      </Text>
      <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: spacing.md }}>
        <Field
          label="Code"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="ABCDE 12345"
          onSubmitEditing={() => void redeem(code)}
        />
      </View>
      {error ? (
        <Text variant="bodyStrong" style={{ color: '#FFB4B4' }}>
          {error}
        </Text>
      ) : null}
      <Button
        label="Start scoring"
        variant="gold"
        size="lg"
        loading={busy}
        disabled={code.trim().length < 6}
        onPress={() => void redeem(code)}
      />
    </Hero>
  );
}
