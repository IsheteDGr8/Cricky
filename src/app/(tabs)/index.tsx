import { useCallback } from 'react';
import { router } from 'expo-router';

import { Loaded, TournamentCard, useTournaments } from '@/features';
import { EmptyState, Screen, useTheme, VirtualList } from '@/ui';

export default function TournamentsScreen() {
  const tournaments = useTournaments();
  const { spacing } = useTheme();
  const open = useCallback(
    (id: string) => router.push({ pathname: '/tournament/[id]', params: { id } }),
    [],
  );

  return (
    <Screen
      title="Tournaments"
      subtitle="Standings, fixtures and stats for every tournament."
      scroll={false}>
      <Loaded value={tournaments} loadingLabel="Loading tournaments…">
        {(list) => (
          <VirtualList
            data={list}
            keyExtractor={(t) => t.id}
            accessibilityLabel="Tournaments"
            contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}
            ListEmptyComponent={
              <EmptyState
                icon="trophy-outline"
                title="No tournaments yet"
                message="Tournaments appear here as soon as an admin creates one."
              />
            }
            renderItem={(t) => <TournamentCard tournament={t} onPress={() => open(t.id)} />}
          />
        )}
      </Loaded>
    </Screen>
  );
}
