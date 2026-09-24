import { onValue, ref, type Database } from 'firebase/database';
import type { Listener, Unsubscribe } from './context';

/** Firebase's own view of whether this client is connected to the database. */
export function watchConnection(db: Database, listener: Listener<boolean>): Unsubscribe {
  return onValue(
    ref(db, '.info/connected'),
    (snap) => listener.onData(snap.val() === true),
    (error) => listener.onError?.(error),
  );
}
