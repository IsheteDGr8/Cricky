import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Loaded, parseMatchRef, useIsStaff, useRecentMatches, type MatchLists } from '@/features';
import {
  Badge,
  brand,
  Button,
  Card,
  EmptyState,
  Field,
  Hero,
  Icon,
  onHero,
  Screen,
  Section,
  Text,
  useTheme,
} from '@/ui';

const openPad = (id: string) => router.push({ pathname: '/score/[id]', params: { id } });

export default function ScoreTab() {
  const { spacing } = useTheme();
  const matches = useRecentMatches(40);
  const staff = useIsStaff();
  const isStaff = staff.status === 'ready' && staff.data;

  return (
    <Screen>
      <Hero>
        <Text variant="title" style={{ color: onHero.strong }}>
          Scoring a match?
        </Text>
        <Text style={{ color: onHero.soft }}>
          {isStaff
            ? 'You are an admin, so you can score any match straight away.'
            : 'Open the scorer link the admin sent you and you are in. No link? Pick the match below and type the 10-character code.'}
        </Text>
      </Hero>

      <Loaded value={matches} loadingLabel="Loading matches…">
        {(lists) => {
          const open = [...lists.live, ...lists.upcoming];
          return open.length ? (
            <Section title="PICK THE MATCH">
              {open.map((m) => (
                <PadRow key={m.id} match={m} />
              ))}
            </Section>
          ) : (
            <EmptyState
              icon="create-outline"
              title="No matches to score"
              message="When an admin starts a match it shows up here."
            />
          );
        }}
      </Loaded>

      <PasteLink />
      <View style={{ height: spacing.lg }} />
    </Screen>
  );
}

function PadRow({ match }: { match: MatchLists['live'][number] }) {
  const { colors, spacing } = useTheme();
  const inn = match.innings?.at(-1);
  return (
    <Card
      onPress={() => openPad(match.id)}
      accessibilityLabel={`Score ${match.teamAName} versus ${match.teamBName}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text variant="bodyStrong">
            {match.teamAName} v {match.teamBName}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {match.status === 'live' ? (
              <Badge label="Live" tone="live" />
            ) : (
              <Badge label="Not started" tone="warning" />
            )}
            {inn ? (
              <Text variant="caption" color="textMuted">
                {inn.runs}/{inn.wickets}
              </Text>
            ) : null}
          </View>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            backgroundColor: brand.gold,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: 999,
          }}>
          <Icon name="create" size={16} color={brand.bar} />
          <Text variant="bodyStrong" style={{ color: brand.bar }}>
            Score
          </Text>
        </View>
        <Icon name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </Card>
  );
}

function PasteLink() {
  const { spacing } = useTheme();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <Text variant="heading">Have a link instead?</Text>
        <Field
          label="Match or scorer link"
          value={input}
          onChangeText={setInput}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://cricky-cricket-analysis.web.app/score/…"
        />
        {error ? <Text color="danger">{error}</Text> : null}
        <Button
          label="Open"
          variant="secondary"
          onPress={() => {
            const code = /[?&]code=([^&#]+)/.exec(input)?.[1];
            const id = parseMatchRef(input);
            if (!id) {
              setError('That does not look like a match link.');
              return;
            }
            router.push({
              pathname: '/score/[id]',
              params: code ? { id, code: decodeURIComponent(code) } : { id },
            });
          }}
        />
      </View>
    </Card>
  );
}
