import { router } from 'expo-router';

import { Button, EmptyState, Screen } from '@/ui';

export default function NotFoundScreen() {
  return (
    <Screen edges={[]}>
      <EmptyState
        icon="help-circle-outline"
        title="Page not found"
        message="This link doesn't point to anything in Cricky."
        action={<Button label="Go to Tournaments" onPress={() => router.replace('/')} />}
      />
    </Screen>
  );
}
