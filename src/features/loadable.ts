import { useEffect, useEffectEvent, useState } from 'react';

import type { Listener, Unsubscribe } from '@/data';

/** A value that arrives later from the backend. */
export type Loadable<T> =
  { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; error: Error };

const LOADING = { status: 'loading' } as const;

/**
 * Subscribes while mounted and re-subscribes when `key` changes (e.g. a different match id).
 * Returns loading until the first value for the current key arrives.
 */
export function useSubscription<T>(
  key: string,
  subscribe: (listener: Listener<T>) => Unsubscribe,
): Loadable<T> {
  const [state, setState] = useState<{ key: string; value: Loadable<T> } | null>(null);
  const start = useEffectEvent(subscribe);

  useEffect(() => {
    let active = true;
    const stop = start({
      onData: (data) => active && setState({ key, value: { status: 'ready', data } }),
      onError: (error) => active && setState({ key, value: { status: 'error', error } }),
    });
    return () => {
      active = false;
      stop();
    };
  }, [key]);

  return state?.key === key ? state.value : LOADING;
}

/** Ready when every input is ready; otherwise the first error, or loading. */
export function combine<T extends readonly unknown[]>(
  ...items: { [K in keyof T]: Loadable<T[K]> }
): Loadable<T> {
  const error = items.find((item) => item.status === 'error');
  if (error) return error;
  if (items.some((item) => item.status === 'loading')) return LOADING;
  return {
    status: 'ready',
    data: items.map((item) => (item as { data: unknown }).data) as unknown as T,
  };
}

/** Derives from a ready value. A throwing `derive` (e.g. unreadable match events) becomes an error. */
export function mapLoadable<T, U>(loadable: Loadable<T>, derive: (data: T) => U): Loadable<U> {
  if (loadable.status !== 'ready') return loadable;
  try {
    return { status: 'ready', data: derive(loadable.data) };
  } catch (error) {
    return { status: 'error', error: error instanceof Error ? error : new Error(String(error)) };
  }
}
