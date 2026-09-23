import { EmptyState, Screen } from '@/ui';

export default function LeadersScreen() {
  return (
    <Screen title="Leaders" subtitle="Top run scorers and wicket takers by tournament.">
      <EmptyState
        icon="podium-outline"
        title="No stats yet"
        message="Leaderboards are calculated from completed tournament matches."
      />
    </Screen>
  );
}
