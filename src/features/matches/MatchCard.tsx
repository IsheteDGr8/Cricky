import { memo } from 'react';
import { View } from 'react-native';

import type { MatchSummary, WithId } from '@/data';
import { Badge, Card, Text, useTheme } from '@/ui';
import { dateText, oversText, summaryResultText } from '../format';

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
  const { colors, spacing, radius } = useTheme();
  const innings = match.innings ?? [];
  const teams = [
    { id: match.teamA, name: match.teamAName },
    { id: match.teamB, name: match.teamBName },
  ];
  if (innings[0]?.battingTeam === match.teamB) teams.reverse();

  const side = (team: string, name: string, align: 'flex-start' | 'flex-end') => {
    const inn = innings.find((i) => i.battingTeam === team);
    const textAlign = align === 'flex-start' ? 'left' : 'right';
    return (
      <View key={team} style={{ flex: 1, alignItems: align, gap: 2 }}>
        <Text variant="bodyStrong" numberOfLines={2} align={textAlign}>
          {name}
        </Text>
        {inn ? (
          <Text
            style={{
              color: colors.primary,
              fontSize: 26,
              lineHeight: 30,
              fontWeight: '800',
              fontVariant: ['tabular-nums'],
            }}>
            {inn.runs}
            <Text variant="bodyStrong" color="textMuted">
              /{inn.wickets}
            </Text>
          </Text>
        ) : (
          <Text variant="caption" color="textMuted">
            Yet to bat
          </Text>
        )}
        {inn ? (
          <Text variant="caption" color="textMuted">
            {oversText(inn.legalBalls)}
          </Text>
        ) : null}
      </View>
    );
  };

  const [first, second] = teams as [(typeof teams)[number], (typeof teams)[number]];
  const result = summaryResultText(match);
  const status =
    match.status === 'live' ? (
      <Badge label="Live" tone="live" />
    ) : match.status === 'scheduled' ? (
      <Badge label="Upcoming" tone="warning" />
    ) : (
      <Badge label="Completed" />
    );

  return (
    <Card
      onPress={onPress}
      style={{ padding: 0, overflow: 'hidden' }}
      accessibilityLabel={`${match.teamAName} versus ${match.teamBName}${result ? `, ${result}` : ''}`}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.surfaceMuted,
        }}>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {status}
          <Badge label={STAGE[match.stage]} tone="brand" />
        </View>
        <Text variant="caption" color="textMuted">
          {dateText(match.updatedAt)}
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          padding: spacing.lg,
        }}>
        {side(first.id, first.name, 'flex-start')}
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: radius.pill,
            backgroundColor: colors.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text variant="label" color="textMuted" style={{ fontWeight: '800' }}>
            VS
          </Text>
        </View>
        {side(second.id, second.name, 'flex-end')}
      </View>

      {result ? (
        <View
          style={{
            backgroundColor: colors.primaryMuted,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.lg,
          }}>
          <Text variant="bodyStrong" color="primary" align="center">
            {result}
          </Text>
        </View>
      ) : null}
    </Card>
  );
});
