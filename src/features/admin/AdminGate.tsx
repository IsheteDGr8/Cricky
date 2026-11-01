import { router } from 'expo-router';
import type { ReactNode } from 'react';

import { Button, EmptyState, LoadingState } from '@/ui';
import { useAdminSignIn } from './hooks';

/** Shows admin screens only to staff; everyone else gets a way to sign in. */
export function AdminGate({ children }: { children: ReactNode }) {
  const { session, staff } = useAdminSignIn();
  if (session.status !== 'ready') return <LoadingState label="Checking sign-in…" />;
  if (!staff) {
    return (
      <EmptyState
        icon="lock-closed-outline"
        title="Admins only"
        message="Sign in with an admin Google account to manage tournaments."
        action={
          <Button
            label="Go to sign-in"
            style={{ alignSelf: 'center' }}
            onPress={() => router.replace('/more')}
          />
        }
      />
    );
  }
  return <>{children}</>;
}
