import { View } from 'react-native';

import { Card, DataTable, Text, useTheme, type DataColumn } from '@/ui';
import { nrrText } from '../format';
import type { TournamentView } from './tournament-view';

const COLUMNS: DataColumn[] = [
  { label: 'Team' },
  { label: 'P', width: 22 },
  { label: 'W', width: 22 },
  { label: 'L', width: 22 },
  { label: 'T', width: 22 },
  { label: 'NRR', width: 56 },
  { label: 'Pts', width: 30 },
];

/** Points table per group, ordered by points then net run rate. */
export function Standings({ view }: { view: TournamentView }) {
  const { spacing } = useTheme();
  if (view.groups.length === 0) return <Text color="textMuted">No teams yet.</Text>;
  return (
    <View style={{ gap: spacing.lg }}>
      {view.groups.map(({ group, rows }) => (
        <Card key={group}>
          <View style={{ gap: spacing.sm }}>
            {view.groups.length > 1 ? <Text variant="heading">Group {group}</Text> : null}
            <DataTable
              accessibilityLabel={`Group ${group} standings`}
              columns={COLUMNS}
              rows={rows.map((row, i) => ({
                key: row.team,
                cells: [
                  `${i + 1}. ${view.teamName(row.team)}`,
                  row.played,
                  row.won,
                  row.lost,
                  row.tied,
                  nrrText(row.netRunRate),
                  row.points,
                ],
              }))}
            />
          </View>
        </Card>
      ))}
      <Text variant="caption" color="textMuted">
        Win 2 points, tie 1. Ties on points are split by net run rate (NRR).
      </Text>
    </View>
  );
}
