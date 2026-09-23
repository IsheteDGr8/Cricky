import { EmptyState, Screen } from '@/ui';

export default function MatchesScreen() {
  return (
    <Screen title="Matches" subtitle="Live and recent matches, including quick matches.">
      <EmptyState
        icon="radio-outline"
        title="No matches yet"
        message="Live scores will appear here once live data is connected."
      />
    </Screen>
  );
}
