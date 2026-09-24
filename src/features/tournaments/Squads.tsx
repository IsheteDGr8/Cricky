import { View } from 'react-native';

import { Card, Text, useTheme } from '@/ui';
import type { TournamentView } from './tournament-view';

export function Squads({ view }: { view: TournamentView }) {
  const { spacing } = useTheme();
  if (view.teams.length === 0) return <Text color="textMuted">No teams yet.</Text>;
  const multipleGroups = view.groups.length > 1;
  return (
    <View style={{ gap: spacing.md }}>
      {view.teams.map((team) => {
        const players = Object.entries(team.players).sort(([, a], [, b]) => a.order - b.order);
        return (
          <Card key={team.id}>
            <View style={{ gap: spacing.xs }}>
              <Text variant="heading">{team.name}</Text>
              <Text variant="caption" color="textMuted">
                {multipleGroups ? `Group ${team.group} · ` : ''}
                {players.length} players
              </Text>
              <Text>
                {players
                  .map(([pid, p]) => (pid === team.captainId ? `${p.name} (c)` : p.name))
                  .join(', ')}
              </Text>
            </View>
          </Card>
        );
      })}
    </View>
  );
}
