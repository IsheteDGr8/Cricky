import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

import type { TeamId } from '@/domain';
import { Card, Text, useTheme } from '@/ui';
import type { TournamentView } from './tournament-view';

/** Semi-finals, 3rd place and final, filled in from the standings and results so far. */
export function Playoffs({ view }: { view: TournamentView }) {
  const { colors, spacing } = useTheme();
  const { bracket, teamName } = view;
  if (!bracket) return <Text color="textMuted">This tournament has no playoffs.</Text>;

  const side = (team: TeamId | null, winner: TeamId | null) => {
    const won = team !== null && team === winner;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text
          variant={won ? 'bodyStrong' : 'body'}
          color={team ? 'text' : 'textMuted'}
          style={{ flex: 1 }}>
          {team ? teamName(team) : 'To be decided'}
        </Text>
        {won ? <Ionicons name="checkmark-circle" size={18} color={colors.success} /> : null}
      </View>
    );
  };

  return (
    <View style={{ gap: spacing.md }}>
      {bracket.champion ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Ionicons name="trophy" size={28} color={colors.accent} />
            <View>
              <Text variant="label" color="textMuted">
                Champions
              </Text>
              <Text variant="title">{teamName(bracket.champion)}</Text>
            </View>
          </View>
        </Card>
      ) : null}
      {bracket.fixtures.map((f) => (
        <Card key={f.id}>
          <View style={{ gap: spacing.sm }}>
            <Text variant="label" color="textMuted">
              {f.name}
            </Text>
            {side(f.home, f.winner)}
            {side(f.away, f.winner)}
          </View>
        </Card>
      ))}
    </View>
  );
}
