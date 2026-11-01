import { Stack } from 'expo-router';

import { AdminGate, MatchWizard } from '@/features';
import { Screen } from '@/ui';

export default function QuickMatchScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Quick match' }} />
      <AdminGate>
        <MatchWizard mode="quick" />
      </AdminGate>
    </Screen>
  );
}
