import { memo } from 'react';
import { View } from 'react-native';

import type { MatchSummary, WithId } from '@/data';
import { Badge, Card, Text, useTheme } from '@/ui';
import { dateText, oversText, scoreText, summaryResultText } from '../format';

export interface MatchCardProps {
  match: WithId<MatchSummary>;
  onPress: () => void;
}

const STAGE: Record<MatchSummary['stage'], string> = {
  group: 'Group',
  playoff: 'Playoff',
  quick: 'Quick match',
};

/** One match in a list: both teams, their scores and the result or live status. */
export const MatchCard = memo(function MatchCard({ match, onPress }: MatchCardProps) {
  const { spacing } = useTheme();
  const innings = match.innings ?? [];
  const teams = [
    { id: match.teamA, name: match.teamAName },
    { id: match.teamB, name: match.teamBName },
  ];
  if (innings[0]?.battingTeam === match.teamB) teams.reverse();
  const line = (team: string, name: string) => {
    const inn = innings.find((i) => i.battingTeam === team);
    return (
      <View
        key={team}
        style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
        <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
          {name}
        </Text>
        {inn ? (
          <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
            {scoreText(inn.runs, inn.wickets)}{' '}
            <Text variant="caption" color="textMuted">
              {oversText(inn.legalBalls)}
            </Text>
          </Text>
        ) : null}
      </View>
    );
  };
  const result = summaryResultText(match);
  const status =
    match.status === 'live' ? (
      <Badge label="Live" tone="live" />
    ) : match.status === 'scheduled' ? (
      <Badge label="Upcoming" />
    ) : null;

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${match.teamAName} versus ${match.teamBName}${result ? `, ${result}` : ''}`}>
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="caption" color="textMuted">
            {STAGE[match.stage]} · {dateText(match.updatedAt)}
          </Text>
          {status}
        </View>
        {teams.map((t) => line(t.id, t.name))}
        {result ? (
          <Text variant="caption" color="primary">
            {result}
          </Text>
        ) : null}
      </View>
    </Card>
  );
});
