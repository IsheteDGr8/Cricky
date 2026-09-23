import { EmptyState, Screen } from '@/ui';

export default function TournamentsScreen() {
  return (
    <Screen title="Tournaments" subtitle="Standings, fixtures and stats for every tournament.">
      <EmptyState
        icon="trophy-outline"
        title="No tournaments yet"
        message="Tournaments will appear here once live data is connected."
      />
    </Screen>
  );
}
