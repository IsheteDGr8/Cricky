import { memo } from 'react';
import { View } from 'react-native';

import type { Tournament, WithId } from '@/data';
import { Badge, Card, Text, useTheme, type BadgeTone } from '@/ui';
import { dateText } from '../format';

const STATUS: Record<Tournament['status'], { label: string; tone: BadgeTone }> = {
  upcoming: { label: 'Upcoming', tone: 'neutral' },
  active: { label: 'In progress', tone: 'brand' },
  complete: { label: 'Complete', tone: 'success' },
  archived: { label: 'Archived', tone: 'neutral' },
};

export const TournamentCard = memo(function TournamentCard({
  tournament,
  onPress,
}: {
  tournament: WithId<Tournament>;
  onPress: () => void;
}) {
  const { spacing } = useTheme();
  const status = STATUS[tournament.status];
  return (
    <Card onPress={onPress} accessibilityLabel={`${tournament.name}, ${status.label}`}>
      <View style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
          <Text variant="heading" style={{ flex: 1 }}>
            {tournament.name}
          </Text>
          <Badge label={status.label} tone={status.tone} />
        </View>
        <Text color="textMuted">
          {tournament.oversDefault} overs · started {dateText(tournament.createdAt)}
        </Text>
      </View>
    </Card>
  );
});
