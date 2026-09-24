import { View } from 'react-native';

import { ballsToOvers } from '@/domain';
import { Card, DataTable, Text, useTheme, type DataColumn } from '@/ui';
import { rateText } from '../format';
import type { TournamentView } from './tournament-view';

const BATTING: DataColumn[] = [
  { label: 'Batter' },
  { label: 'Inn', width: 32 },
  { label: 'Runs', width: 44 },
  { label: 'HS', width: 40 },
  { label: 'SR', width: 56 },
];

const BOWLING: DataColumn[] = [
  { label: 'Bowler' },
  { label: 'O', width: 40 },
  { label: 'Wkts', width: 44 },
  { label: 'Best', width: 44 },
  { label: 'Econ', width: 52 },
];

/** Top run scorers and wicket takers across every completed match. */
export function Leaders({ view, limit = 10 }: { view: TournamentView; limit?: number }) {
  const { spacing } = useTheme();
  const { playerName, teamName } = view;
  if (view.batting.length === 0) {
    return <Text color="textMuted">Leaderboards appear after the first completed match.</Text>;
  }
  return (
    <View style={{ gap: spacing.lg }}>
      <Card>
        <View style={{ gap: spacing.sm }}>
          <Text variant="heading">Most runs</Text>
          <DataTable
            accessibilityLabel="Most runs"
            columns={BATTING}
            rows={view.batting.slice(0, limit).map((b) => ({
              key: b.player,
              cells: [
                playerName(b.player),
                b.innings,
                b.runs,
                `${b.highest}${b.highestNotOut ? '*' : ''}`,
                rateText(b.strikeRate),
              ],
              detail: teamName(b.team),
            }))}
          />
        </View>
      </Card>
      <Card>
        <View style={{ gap: spacing.sm }}>
          <Text variant="heading">Most wickets</Text>
          <DataTable
            accessibilityLabel="Most wickets"
            columns={BOWLING}
            rows={view.bowling.slice(0, limit).map((b) => ({
              key: b.player,
              cells: [
                playerName(b.player),
                ballsToOvers(b.legalBalls),
                b.wickets,
                `${b.best.wickets}/${b.best.runs}`,
                rateText(b.economy),
              ],
              detail: teamName(b.team),
            }))}
          />
        </View>
      </Card>
    </View>
  );
}
