import type { Session } from '@/data';
import { useDataLayer } from './data-provider';
import { useSubscription, type Loadable } from './loadable';

/** Current user (null if nobody is signed in), including their admin role. */
export function useSession(): Loadable<Session | null> {
  const { auth } = useDataLayer();
  return useSubscription('session', (listener) =>
    auth.watchSession((session) => listener.onData(session)),
  );
}

export function isStaff(session: Session | null): boolean {
  return session?.role === 'admin' || session?.role === 'owner';
}
