import { router, type Href } from 'expo-router';
import { View } from 'react-native';

import {
  HowItWorks,
  LiveCard,
  Loaded,
  MatchCard,
  TournamentCard,
  useRecentMatches,
  useTournaments,
} from '@/features';
import { Card, Icon, Screen, Section, Text, useTheme } from '@/ui';

const openMatch = (id: string) => router.push({ pathname: '/match/[id]', params: { id } });

export default function HomeScreen() {
  const { colors, spacing } = useTheme();
  const matches = useRecentMatches(30);
  const tournaments = useTournaments();

  return (
    <Screen>
      <Loaded value={matches} loadingLabel="Loading matches…">
        {(lists) => (
          <View style={{ gap: spacing.xl }}>
            {lists.live.length ? (
              <Section title="LIVE NOW">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                  {lists.live.map((m) => (
                    <View key={m.id} style={{ flexGrow: 1, flexBasis: 320 }}>
                      <LiveCard match={m} onPress={() => openMatch(m.id)} />
                    </View>
                  ))}
                </View>
              </Section>
            ) : (
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Icon name="moon-outline" size={24} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">No cricket live right now</Text>
                    <Text variant="caption" color="textMuted">
                      Live games appear here the moment the first ball is scored.
                    </Text>
                  </View>
                </View>
              </Card>
            )}

            <Loaded value={tournaments} loadingLabel="Loading tournaments…">
              {(list) => {
                const shown = list.filter((t) => t.status !== 'archived');
                return shown.length ? (
                  <Section title="TOURNAMENTS">
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                      {shown.map((t) => (
                        <View key={t.id} style={{ flexGrow: 1, flexBasis: 320 }}>
                          <TournamentCard
                            tournament={t}
                            onPress={() =>
                              router.push({ pathname: '/tournament/[id]', params: { id: t.id } })
                            }
                          />
                        </View>
                      ))}
                    </View>
                  </Section>
                ) : null;
              }}
            </Loaded>

            {lists.upcoming.length ? (
              <Section title="ABOUT TO START">
                {lists.upcoming.slice(0, 3).map((m) => (
                  <MatchCard key={m.id} match={m} onPress={() => openMatch(m.id)} />
                ))}
              </Section>
            ) : null}

            {lists.finished.length ? (
              <Section
                title="LATEST RESULTS"
                action={{ label: 'All matches', onPress: () => router.push('/matches' as Href) }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                  {lists.finished.slice(0, 4).map((m) => (
                    <View key={m.id} style={{ flexGrow: 1, flexBasis: 320 }}>
                      <MatchCard match={m} onPress={() => openMatch(m.id)} />
                    </View>
                  ))}
                </View>
              </Section>
            ) : null}

            <HowItWorks />
          </View>
        )}
      </Loaded>
    </Screen>
  );
}
