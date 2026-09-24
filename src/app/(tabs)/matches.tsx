import { useCallback, useMemo } from 'react';
import { router } from 'expo-router';

import { Loaded, MatchCard, useRecentMatches, type MatchLists } from '@/features';
import { EmptyState, Screen, Text, useTheme, VirtualList } from '@/ui';

type ListedMatch = MatchLists['live'][number];
type Row =
  { kind: 'header'; id: string; title: string } | { kind: 'match'; id: string; match: ListedMatch };

export default function MatchesScreen() {
  const matches = useRecentMatches();
  const { spacing } = useTheme();
  const open = useCallback(
    (id: string) => router.push({ pathname: '/match/[id]', params: { id } }),
    [],
  );

  return (
    <Screen
      title="Matches"
      subtitle="Live and recent matches, including quick matches."
      scroll={false}>
      <Loaded value={matches} loadingLabel="Loading matches…">
        {(lists) => <MatchList lists={lists} spacing={spacing.md} open={open} />}
      </Loaded>
    </Screen>
  );
}

function MatchList({
  lists,
  spacing,
  open,
}: {
  lists: MatchLists;
  spacing: number;
  open: (id: string) => void;
}) {
  const rows = useMemo(() => rowsOf(lists), [lists]);
  if (rows.length === 0) {
    return (
      <EmptyState
        icon="radio-outline"
        title="No matches yet"
        message="Matches appear here as soon as they are scheduled."
      />
    );
  }
  return (
    <VirtualList
      data={rows}
      keyExtractor={(row) => row.id}
      accessibilityLabel="Matches"
      contentContainerStyle={{ gap: spacing, paddingBottom: spacing * 2 }}
      renderItem={(row) =>
        row.kind === 'header' ? (
          <Text variant="label" color="textMuted" accessibilityRole="header">
            {row.title}
          </Text>
        ) : (
          <MatchCard match={row.match} onPress={() => open(row.match.id)} />
        )
      }
    />
  );
}

function rowsOf(lists: MatchLists): Row[] {
  const rows: Row[] = [];
  const add = (title: string, matches: MatchLists['live']) => {
    if (matches.length === 0) return;
    rows.push({ kind: 'header', id: `h-${title}`, title });
    for (const match of matches) rows.push({ kind: 'match', id: match.id, match });
  };
  add('Live', lists.live);
  add('Upcoming', lists.upcoming);
  add('Results', lists.finished);
  return rows;
}
