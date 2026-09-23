import { useLocalSearchParams } from 'expo-router';

import { EmptyState, Screen } from '@/ui';

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen edges={[]}>
      <EmptyState
        icon="stats-chart-outline"
        title="Scorecard coming soon"
        message={`Match ${id} will show its live scorecard and commentary here.`}
      />
    </Screen>
  );
}
