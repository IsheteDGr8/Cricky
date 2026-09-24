import type { Database, Unsubscribe } from 'firebase/database';
import { DataError } from './errors';

/** What every repository needs. Injected so tests can point repositories at the emulator. */
export interface DataContext {
  db: Database;
  currentUid: () => string | null;
}

export interface Listener<T> {
  onData: (value: T) => void;
  onError?: (error: Error) => void;
}

export type { Unsubscribe };

export function requireUid(ctx: DataContext): string {
  const uid = ctx.currentUid();
  if (!uid) throw new DataError('not_signed_in', 'Sign in first');
  return uid;
}

/** Firebase drops empty values and may return integer-keyed maps as arrays; this undoes both. */
export function entriesOf(value: unknown): [string, unknown][] {
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).filter(([, v]) => v !== null && v !== undefined);
}
