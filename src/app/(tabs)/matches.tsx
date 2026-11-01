import { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Loaded, MatchCard, useRecentMatches, type MatchLists } from '@/features';
import { Chip, EmptyState, Screen, Text, useTheme, VirtualList } from '@/ui';

type ListedMatch = MatchLists['live'][number];
type Row =
  { kind: 'header'; id: string; title: string } | { kind: 'match'; id: string; match: ListedMatch };
type Filter = 'all' | 'live' | 'upcoming' | 'finished';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'finished', label: 'Results' },
];

export default function MatchesScreen() {
  const matches = useRecentMatches();
  const { spacing } = useTheme();
  const [filter, setFilter] = useState<Filter>('all');
  const open = useCallback(
    (id: string) => router.push({ pathname: '/match/[id]', params: { id } }),
    [],
  );

  return (
    <Screen title="Matches" subtitle="Tap any match for the full scorecard." scroll={false}>
      <Loaded value={matches} loadingLabel="Loading matches…">
        {(lists) => (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {FILTERS.map((f) => (
                <Chip
                  key={f.value}
                  label={f.label}
                  count={f.value === 'all' ? undefined : lists[f.value].length}
                  selected={filter === f.value}
                  onPress={() => setFilter(f.value)}
                />
              ))}
            </View>
            <MatchList lists={lists} filter={filter} spacing={spacing.md} open={open} />
          </>
        )}
      </Loaded>
    </Screen>
  );
}

function MatchList({
  lists,
  filter,
  spacing,
  open,
}: {
  lists: MatchLists;
  filter: Filter;
  spacing: number;
  open: (id: string) => void;
}) {
  const rows = useMemo(() => rowsOf(lists, filter), [lists, filter]);
  if (rows.length === 0) {
    return (
      <EmptyState
        icon="radio-outline"
        title={filter === 'live' ? 'Nothing live right now' : 'No matches here yet'}
        message="Matches appear here as soon as an admin starts them."
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
          <Text
            variant="label"
            color="primary"
            accessibilityRole="header"
            style={{ fontWeight: '800', marginTop: spacing }}>
            {row.title}
          </Text>
        ) : (
          <MatchCard match={row.match} onPress={() => open(row.match.id)} />
        )
      }
    />
  );
}

function rowsOf(lists: MatchLists, filter: Filter): Row[] {
  const rows: Row[] = [];
  const add = (key: Exclude<Filter, 'all'>, title: string) => {
    const matches = lists[key];
    if (matches.length === 0 || (filter !== 'all' && filter !== key)) return;
    rows.push({ kind: 'header', id: `h-${title}`, title });
    for (const match of matches) rows.push({ kind: 'match', id: match.id, match });
  };
  add('live', 'Live');
  add('upcoming', 'Upcoming');
  add('finished', 'Results');
  return rows;
}
