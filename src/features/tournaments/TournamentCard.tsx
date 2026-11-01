import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import { View } from 'react-native';

import type { Tournament, WithId } from '@/data';
import { Badge, Card, Text, useTheme, type BadgeTone } from '@/ui';
import { dateText } from '../format';

const STATUS: Record<Tournament['status'], { label: string; tone: BadgeTone }> = {
  upcoming: { label: 'Upcoming', tone: 'warning' },
  active: { label: 'Active', tone: 'success' },
  complete: { label: 'Completed', tone: 'neutral' },
  archived: { label: 'Archived', tone: 'neutral' },
};

export const TournamentCard = memo(function TournamentCard({
  tournament,
  onPress,
}: {
  tournament: WithId<Tournament>;
  onPress: () => void;
}) {
  const { colors, spacing } = useTheme();
  const status = STATUS[tournament.status];
  return (
    <Card onPress={onPress} accessibilityLabel={`${tournament.name}, ${status.label}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Badge label={status.label} tone={status.tone} />
          <Text variant="heading" color="primary">
            {tournament.name}
          </Text>
          <Text color="textMuted">
            {tournament.oversDefault} overs · started {dateText(tournament.createdAt)}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.textMuted}
          accessibilityElementsHidden
        />
      </View>
    </Card>
  );
});
