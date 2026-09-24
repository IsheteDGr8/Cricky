import { router } from 'expo-router';
import { View } from 'react-native';

import { Loaded, MatchCard, useRecentMatches, type MatchLists } from '@/features';
import { EmptyState, Screen, Text, useTheme } from '@/ui';

export default function MatchesScreen() {
  const matches = useRecentMatches();

  return (
    <Screen title="Matches" subtitle="Live and recent matches, including quick matches.">
      <Loaded value={matches} loadingLabel="Loading matches…">
        {({ live, upcoming, finished }) =>
          live.length + upcoming.length + finished.length === 0 ? (
            <EmptyState
              icon="radio-outline"
              title="No matches yet"
              message="Matches appear here as soon as they are scheduled."
            />
          ) : (
            <>
              <Section title="Live" matches={live} />
              <Section title="Upcoming" matches={upcoming} />
              <Section title="Results" matches={finished} />
            </>
          )
        }
      </Loaded>
    </Screen>
  );
}

function Section({ title, matches }: { title: string; matches: MatchLists['live'] }) {
  const { spacing } = useTheme();
  if (matches.length === 0) return null;
  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="label" color="textMuted" accessibilityRole="header">
        {title}
      </Text>
      {matches.map((m) => (
        <MatchCard
          key={m.id}
          match={m}
          onPress={() => router.push({ pathname: '/match/[id]', params: { id: m.id } })}
        />
      ))}
    </View>
  );
}
